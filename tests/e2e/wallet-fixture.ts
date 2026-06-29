/**
 * Mock EIP-1193 wallet fixture for Playwright.
 *
 * Injected via `page.addInitScript` BEFORE any page script runs, so
 * the WalletProvider in `src/lib/wallet.tsx` sees `window.ethereum`
 * just like in a real browser session.
 *
 * **No real private keys for funded accounts.** The fixture uses the
 * well-known anvil[0] dev key (public, never holds real funds) so the
 * `personal_sign` flow can produce a signature that recovers to the
 * test account address. The key is constant + dev-only + never used
 * outside this fixture; the file never logs the key or signatures.
 *
 * Capabilities:
 *
 *   - `eth_requestAccounts`, `eth_accounts`, `eth_chainId`,
 *     `wallet_switchEthereumChain`
 *   - `eth_signTypedData_v4`, `eth_signTypedData` — return a
 *     deterministic 65-byte mock signature shape; existing write-auth
 *     tests rely on this. The backend's EIP-712 validator runs as a
 *     unit test against real signatures, not in these browser specs.
 *   - `personal_sign` — produces a REAL EIP-191 secp256k1 signature
 *     that recovers to the test account. The signer runs Node-side
 *     via `page.exposeFunction` so we don't bundle crypto into the
 *     browser-injected init script.
 *
 * Configurable via:
 *   - `window.__deoptMockWallet.setAccount(addr | null)`
 *   - `window.__deoptMockWallet.setChainId(id)`
 *   - `window.__deoptMockWallet.setNextSignReject(true)`
 */

import { Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

export interface MockWalletConfig {
  account?: `0x${string}`;
  chainId?: number;
  signatureRejected?: boolean;
}

// Anvil[0] — well-known, public, dev-only deterministic key. Used by
// every Hardhat / Anvil / Foundry test in the world. Never holds real
// funds. Required because EIP-191 `personal_sign` must produce a
// signature that recovers to the test wallet address; a fabricated
// signature like `0x12…` would fail any verifier the test might add.
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY);

export const DEFAULT_TEST_ACCOUNT: `0x${string}` = TEST_ACCOUNT.address;
export const ANVIL_CHAIN_ID = 31337;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

const MOCK_TYPED_SIGNATURE =
  "0x" +
  "12".repeat(64) +
  "1c"; /* v = 28; 65 bytes hex-encoded = 132 chars after 0x */

// Deterministic fake tx hash returned by `eth_sendTransaction` so the
// `TestnetFaucet.claim()` UX can resolve in browser tests without a
// real chain. Recognisable shape (alternating bytes) so log scans
// know it's a test artifact, not a real Base Sepolia hash.
export const MOCK_TX_HASH: `0x${string}` =
  "0xdeadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00d";

// Page-scoped guard so `installMockWallet` can be called more than
// once per page without re-registering the exposed function (which
// would throw `Function "__deoptPersonalSign" has been already
// registered`). Playwright doesn't expose a "is this name already
// registered" check, so we track it ourselves via a WeakSet of pages.
const exposedPages = new WeakSet<Page>();

export async function installMockWallet(
  page: Page,
  cfg: MockWalletConfig = {},
): Promise<void> {
  const account = cfg.account ?? DEFAULT_TEST_ACCOUNT;
  const chainId = cfg.chainId ?? ANVIL_CHAIN_ID;
  const signatureRejected = !!cfg.signatureRejected;

  // Node-side EIP-191 signer. The browser will call this via
  // `page.exposeFunction` whenever the WalletProvider issues a
  // `personal_sign` (which viem's `walletClient.signMessage` does).
  if (!exposedPages.has(page)) {
    await page.exposeFunction(
      "__deoptPersonalSign",
      async (message: string): Promise<`0x${string}`> => {
        return TEST_ACCOUNT.signMessage({ message });
      },
    );
    exposedPages.add(page);
  }

  await page.addInitScript(
    ({
      account,
      chainId,
      signatureRejected,
      MOCK_TYPED_SIGNATURE,
      MOCK_TX_HASH,
    }) => {
      type Handler = (...args: unknown[]) => void;
      const listeners: Map<string, Handler[]> = new Map();

      const state = {
        account: account as `0x${string}` | null,
        chainId: chainId as number,
        signatureRejected,
      };

      const emit = (event: string, payload: unknown) => {
        (listeners.get(event) ?? []).forEach((h) => h(payload));
      };

      function hexToUtf8(hex: string): string {
        const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        }
        return new TextDecoder().decode(bytes);
      }

      const provider = {
        async request(args: { method: string; params?: unknown[] }) {
          switch (args.method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return state.account ? [state.account] : [];
            case "eth_chainId":
              return "0x" + state.chainId.toString(16);
            case "wallet_switchEthereumChain": {
              const p = (args.params?.[0] as { chainId?: string }) ?? {};
              if (p.chainId) {
                state.chainId = parseInt(p.chainId, 16);
                emit("chainChanged", p.chainId);
              }
              return null;
            }
            case "eth_signTypedData_v4":
            case "eth_signTypedData": {
              if (state.signatureRejected) {
                const err: Error & { code?: number } = new Error(
                  "User rejected the request.",
                );
                err.code = 4001;
                throw err;
              }
              return MOCK_TYPED_SIGNATURE;
            }
            case "personal_sign": {
              if (state.signatureRejected) {
                const err: Error & { code?: number } = new Error(
                  "User rejected the request.",
                );
                err.code = 4001;
                throw err;
              }
              // EIP-1193 spec: `personal_sign(message, address)`. viem's
              // `walletClient.signMessage` hex-encodes the UTF-8
              // message before dispatching, so we decode it back here
              // and pass the original string to the Node-side signer
              // so the produced signature recovers to the test account.
              const messageHex = args.params?.[0];
              if (typeof messageHex !== "string") {
                throw new Error("personal_sign expected a hex string message");
              }
              const message = /^0x[0-9a-fA-F]*$/.test(messageHex)
                ? hexToUtf8(messageHex)
                : messageHex;
              const exposed = (window as unknown as {
                __deoptPersonalSign?: (m: string) => Promise<`0x${string}`>;
              }).__deoptPersonalSign;
              if (!exposed) {
                throw new Error(
                  "test signer __deoptPersonalSign is not exposed on this page",
                );
              }
              return await exposed(message);
            }
            case "eth_sendTransaction": {
              // TESTNET-PUBLIC-FAUCET-CONTRACT-V1 — support the
              // faucet `claim()` UX in browser tests. NO real tx is
              // broadcast (this is a mock provider in a Playwright
              // page); we return a deterministic 32-byte hash so
              // viem resolves and the UI shows its success state.
              // Rejection path mirrors the sign handlers so tests
              // can drive the error UX too.
              if (state.signatureRejected) {
                const err: Error & { code?: number } = new Error(
                  "User rejected the request.",
                );
                err.code = 4001;
                throw err;
              }
              return MOCK_TX_HASH;
            }
            default:
              return null;
          }
        },
        on(event: string, handler: Handler) {
          const arr = listeners.get(event) ?? [];
          arr.push(handler);
          listeners.set(event, arr);
        },
        removeListener(event: string, handler: Handler) {
          const arr = listeners.get(event) ?? [];
          listeners.set(
            event,
            arr.filter((h) => h !== handler),
          );
        },
      };

      (window as unknown as { ethereum: typeof provider }).ethereum =
        provider;
      (window as unknown as { __deoptMockWallet: object }).__deoptMockWallet =
        {
          setAccount(addr: `0x${string}` | null) {
            state.account = addr;
            emit("accountsChanged", addr ? [addr] : []);
          },
          setChainId(id: number) {
            state.chainId = id;
            emit("chainChanged", "0x" + id.toString(16));
          },
          setNextSignReject(v: boolean) {
            state.signatureRejected = v;
          },
        };
    },
    { account, chainId, signatureRejected, MOCK_TYPED_SIGNATURE, MOCK_TX_HASH },
  );
}

/**
 * TESTNET-PUBLIC-FAUCET-CONTRACT-V1 — inject a runtime faucet
 * address override. `MintTokensCard` reads
 * `process.env.NEXT_PUBLIC_TESTNET_FAUCET_ADDRESS` first (build-time
 * inlined); if empty, it falls back to `window.__deoptFaucetAddress`
 * so Playwright can flip the card between request-mode and
 * claim-mode without rebuilding. Pass `null` to clear the override.
 */
export async function setMockFaucetAddress(
  page: Page,
  address: `0x${string}` | null,
): Promise<void> {
  await page.addInitScript((addr) => {
    (window as unknown as { __deoptFaucetAddress?: string | null }).__deoptFaucetAddress =
      addr;
  }, address);
}
