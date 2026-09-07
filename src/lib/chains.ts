// Chain metadata for the DeOpt V2 trading MVP.
//
// **Posture:** mainnet is GATED in the UI; the constant `MAINNET` is
// defined but every chain-selector / banner refuses to enable trading
// against it. Mainnet activation is gated on M-P7 closure + external
// audit completion per the product-readiness roadmap.
//
// DEOPT_MULTICHAIN_MULTICOLLATERAL_FOUNDATION_V1 — this file now also
// carries per-chain `writeAuthDomain` configuration so `write-auth.ts`
// can look up the EIP-712 domain by active chain instead of hard-
// coding a Base-Sepolia literal. The Base Sepolia values are BYTE-
// FROZEN and must never drift — the shared canonical bytes on the
// signing path are asserted by `tests/node/write-auth-canonical.contract.mjs`
// and by the backend at `src/auth/write_authorization.rs`.

/**
 * DEOPT_MULTICHAIN_MULTICOLLATERAL_FOUNDATION_V1 — per-chain EIP-712
 * write-authorization domain configuration.
 *
 * Every field is byte-participating in the domain separator hash that
 * appears on every wallet-signed request; changing any of these values
 * silently invalidates every previously issued authorization for that
 * chain. When adding a new chain, the salt preimage MUST include the
 * chain's short name so the domain separator cannot collide across
 * chains.
 */
export interface WriteAuthDomainConfig {
  /** EIP-712 domain `name` — global to the API, not per-chain. */
  name: string;
  /** EIP-712 domain `version` — bumped per breaking wire change. */
  version: string;
  /** EIP-712 domain `chainId` — must equal the chain's `id`. */
  chainId: number;
  /** Preimage the salt is derived from via keccak256 of UTF-8 bytes. */
  saltPreimage: string;
  /** Environment tag emitted inside each authorization message. */
  environment: string;
}

export interface ChainMeta {
  id: number;
  name: string;
  shortName: string;
  isTestnet: boolean;
  isMainnetGated: boolean;
  explorerUrl?: string;
  /**
   * DEOPT_MULTICHAIN_MULTICOLLATERAL_FOUNDATION_V1 — per-chain
   * write-auth EIP-712 domain. Present for every chain the platform
   * could ever accept signed requests from; consumed by
   * `write-auth.ts` via `expectedChain()`.
   */
  writeAuthDomain: WriteAuthDomainConfig;
}

export const ANVIL: ChainMeta = {
  id: 31337,
  name: "Anvil (local)",
  shortName: "anvil",
  isTestnet: true,
  isMainnetGated: false,
  writeAuthDomain: {
    name: "DeOpt API Write",
    version: "1",
    chainId: 31337,
    saltPreimage: "deopt-api-write:anvil:v1",
    environment: "anvil",
  },
};

export const BASE_SEPOLIA: ChainMeta = {
  id: 84532,
  name: "Base Sepolia",
  shortName: "sepolia",
  isTestnet: true,
  isMainnetGated: false,
  explorerUrl: "https://sepolia.basescan.org",
  writeAuthDomain: {
    // BYTE-FROZEN. Every field below participates in the EIP-712
    // domain separator that gates all wallet-signed authorizations
    // for Base Sepolia. Do not modify without a coordinated backend
    // release + invalidation of every outstanding challenge. The
    // wire-contract tests assert the exact literal values here.
    name: "DeOpt API Write",
    version: "1",
    chainId: 84532,
    saltPreimage: "deopt-api-write:base-sepolia:v1",
    environment: "base-sepolia",
  },
};

export const BASE_MAINNET: ChainMeta = {
  id: 8453,
  name: "Base mainnet",
  shortName: "mainnet",
  isTestnet: false,
  isMainnetGated: true, // UI refuses to enable trading; banner only.
  explorerUrl: "https://basescan.org",
  writeAuthDomain: {
    // Never active in V1 — `isMainnetEnabled()` returns false and
    // every signing site rejects wrong-network wallets before this
    // domain is ever consulted. Populated so a future activation is
    // a config change, not a schema change.
    name: "DeOpt API Write",
    version: "1",
    chainId: 8453,
    saltPreimage: "deopt-api-write:base-mainnet:v1",
    environment: "base-mainnet",
  },
};

export const KNOWN_CHAINS: ChainMeta[] = [ANVIL, BASE_SEPOLIA, BASE_MAINNET];

export function findChain(chainId: number | undefined): ChainMeta | undefined {
  if (chainId === undefined) return undefined;
  return KNOWN_CHAINS.find((c) => c.id === chainId);
}

export function expectedChainId(): number {
  if (typeof process !== "undefined") {
    const env = process.env.NEXT_PUBLIC_CHAIN_ENV;
    if (env === "anvil") return ANVIL.id;
    if (env === "sepolia") return BASE_SEPOLIA.id;
    if (env === "mainnet") {
      // Refuse to ever default to mainnet — the UI gate keeps mainnet OFF.
      return BASE_SEPOLIA.id;
    }
  }
  return BASE_SEPOLIA.id;
}

export function expectedChain(): ChainMeta {
  return findChain(expectedChainId()) ?? BASE_SEPOLIA;
}

export function isMainnetEnabled(): boolean {
  // Hard-coded false. Mainnet activation post-M-P7 + external audit.
  return false;
}
