/**
 * Mock EIP-1193 wallet fixture for Playwright.
 *
 * Injected via `page.addInitScript` BEFORE any page script runs, so
 * the WalletProvider in `src/lib/wallet.tsx` sees `window.ethereum`
 * just like in a real browser session.
 *
 * **No real private keys.** No real signing — `eth_signTypedData_v4`
 * returns a deterministic mock signature shape `0x` + 130 hex chars.
 * Configurable via Playwright `page.evaluate` to simulate:
 *   - connected vs disconnected (`window.__deoptMockWallet.setAccount(...)`)
 *   - chain id changes (`...setChainId(...)`)
 *   - user rejection (`...setNextSignReject(true)`)
 *   - wrong network (`...setChainId(8453)` triggers MainnetDisabledBanner)
 */

import { Page } from "@playwright/test";

export interface MockWalletConfig {
  account?: `0x${string}`;
  chainId?: number;
  signatureRejected?: boolean;
}

export const DEFAULT_TEST_ACCOUNT: `0x${string}` =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // anvil[0] public address; well-known dev key, no funds
export const ANVIL_CHAIN_ID = 31337;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

const MOCK_SIGNATURE =
  "0x" +
  "12".repeat(64) +
  "1c"; /* v = 28; total = 132 chars = 65 bytes hex-encoded with 0x prefix */

export async function installMockWallet(
  page: Page,
  cfg: MockWalletConfig = {},
): Promise<void> {
  const account = cfg.account ?? DEFAULT_TEST_ACCOUNT;
  const chainId = cfg.chainId ?? ANVIL_CHAIN_ID;
  const signatureRejected = !!cfg.signatureRejected;

  await page.addInitScript(
    ({ account, chainId, signatureRejected, MOCK_SIGNATURE }) => {
      // Listener registry for `eth.on(...)`.
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
              return MOCK_SIGNATURE;
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

      // Inject as both window.ethereum and a control surface.
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
    { account, chainId, signatureRejected, MOCK_SIGNATURE },
  );
}
