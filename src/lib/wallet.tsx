"use client";

// Wallet context — M-P3b: upgraded to viem.
//
// Adds `signTypedData()` capable of signing EIP-712 typed data via the
// connected wallet. NO transaction send. NO broadcast. NO mainnet.
// `signTypedData` requires explicit user click on the trade ticket;
// there is no auto-signing anywhere.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type Address,
  type WalletClient,
  createWalletClient,
  custom,
  type EIP1193Provider,
} from "viem";
import { anvil, baseSepolia } from "viem/chains";
import {
  expectedChainId,
  isMainnetEnabled,
  BASE_MAINNET,
  ANVIL,
} from "./chains";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export interface SignTypedDataArgs {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: Address;
    salt?: `0x${string}`;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export type SignResult =
  | { ok: true; signature: `0x${string}` }
  | { ok: false; reason: "rejected" | "no_provider" | "wrong_network" | "error"; message?: string };

export interface WalletState {
  address: Address | null;
  chainId: number | null;
  isConnecting: boolean;
  hasProvider: boolean;
  isMainnet: boolean;
  isExpectedChain: boolean;
  walletClient: WalletClient | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTypedData: (args: SignTypedDataArgs) => Promise<SignResult>;
  /**
   * FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — EIP-191 personal-sign for
   * the public-WS auth handshake (`auth.challenge` / `auth.verify`).
   * Returns the same `SignResult` shape as `signTypedData` so callers
   * have one error-handling path.
   *
   * NEVER logs the message bytes, the returned signature, or any
   * intermediate viem result. The wallet provider's own UX is what
   * shows the user what they're signing.
   */
  signMessage: (message: string) => Promise<SignResult>;
}

const Ctx = createContext<WalletState | null>(null);

function chainFor(id: number) {
  if (id === ANVIL.id) return anvil;
  return baseSepolia;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasProvider(!!window.ethereum);
  }, []);

  // Subscribe to provider events when connected.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = window.ethereum;
    if (!eth || !address) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const next = (accounts && accounts[0]) || null;
      setAddress(next ? (next as Address) : null);
    };
    const onChain = (...args: unknown[]) => {
      const chainHex = args[0] as string | undefined;
      if (typeof chainHex === "string") {
        setChainId(parseInt(chainHex, 16));
      }
    };
    // viem's EIP1193Provider typing matches the canonical injected shape,
    // but the `on` / `removeListener` callbacks aren't part of the typed
    // surface — cast at the call site.
    const ethRaw = eth as unknown as {
      on?: (e: string, h: (...a: unknown[]) => void) => void;
      removeListener?: (e: string, h: (...a: unknown[]) => void) => void;
    };
    ethRaw.on?.("accountsChanged", onAccounts);
    ethRaw.on?.("chainChanged", onChain);
    return () => {
      ethRaw.removeListener?.("accountsChanged", onAccounts);
      ethRaw.removeListener?.("chainChanged", onChain);
    };
  }, [address]);

  const buildClient = useCallback((eth: EIP1193Provider, chain: number) => {
    return createWalletClient({
      chain: chainFor(chain),
      transport: custom(eth),
    });
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined") return;
    const eth = window.ethereum;
    if (!eth) {
      setHasProvider(false);
      return;
    }
    setIsConnecting(true);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      const acct = accounts[0];
      const chainHex = (await eth.request({
        method: "eth_chainId",
      })) as string;
      const chain = typeof chainHex === "string" ? parseInt(chainHex, 16) : null;
      setAddress(acct ? (acct as Address) : null);
      setChainId(chain);
      if (chain !== null) {
        setWalletClient(buildClient(eth, chain));
      }
    } catch (e) {
      console.warn("wallet connect failed", e);
    } finally {
      setIsConnecting(false);
    }
  }, [buildClient]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setWalletClient(null);
  }, []);

  const isMainnet = chainId === BASE_MAINNET.id;
  const expected = expectedChainId();
  const isExpectedChain = chainId !== null && chainId === expected && !isMainnet;

  // Defence-in-depth: even if a wallet reports mainnet AND we accidentally
  // forgot the gate, isMainnetEnabled() is hard-coded false.
  void isMainnetEnabled;

  const signTypedData = useCallback(
    async (args: SignTypedDataArgs): Promise<SignResult> => {
      if (!walletClient || !address) {
        return { ok: false, reason: "no_provider" };
      }
      if (isMainnet || !isExpectedChain) {
        return { ok: false, reason: "wrong_network" };
      }
      try {
        const sig = await walletClient.signTypedData({
          account: address,
          domain: args.domain,
          types: args.types,
          primaryType: args.primaryType,
          message: args.message,
        } as Parameters<WalletClient["signTypedData"]>[0]);
        return { ok: true, signature: sig as `0x${string}` };
      } catch (e: unknown) {
        const msg = (e as { message?: string }).message ?? "signature failed";
        // viem / wallet typically reports a rejection with code 4001.
        const code = (e as { code?: number }).code;
        if (code === 4001) {
          return { ok: false, reason: "rejected", message: msg };
        }
        return { ok: false, reason: "error", message: msg };
      }
    },
    [walletClient, address, isMainnet, isExpectedChain],
  );

  const signMessage = useCallback(
    async (message: string): Promise<SignResult> => {
      if (!walletClient || !address) {
        return { ok: false, reason: "no_provider" };
      }
      if (isMainnet || !isExpectedChain) {
        return { ok: false, reason: "wrong_network" };
      }
      try {
        const sig = await walletClient.signMessage({
          account: address,
          message,
        });
        return { ok: true, signature: sig as `0x${string}` };
      } catch (e: unknown) {
        const msg = (e as { message?: string }).message ?? "signature failed";
        const code = (e as { code?: number }).code;
        if (code === 4001) {
          return { ok: false, reason: "rejected", message: msg };
        }
        return { ok: false, reason: "error", message: msg };
      }
    },
    [walletClient, address, isMainnet, isExpectedChain],
  );

  return (
    <Ctx.Provider
      value={{
        address,
        chainId,
        isConnecting,
        hasProvider,
        isMainnet,
        isExpectedChain,
        walletClient,
        connect,
        disconnect,
        signTypedData,
        signMessage,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useWallet must be used inside <WalletProvider>");
  }
  return v;
}
