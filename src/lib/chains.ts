// Chain metadata for the DeOpt V2 trading MVP.
//
// **Posture:** mainnet is GATED in the UI; the constant `MAINNET` is
// defined but every chain-selector / banner refuses to enable trading
// against it. Mainnet activation is gated on M-P7 closure + external
// audit completion per the product-readiness roadmap.

export interface ChainMeta {
  id: number;
  name: string;
  shortName: string;
  isTestnet: boolean;
  isMainnetGated: boolean;
  explorerUrl?: string;
}

export const ANVIL: ChainMeta = {
  id: 31337,
  name: "Anvil (local)",
  shortName: "anvil",
  isTestnet: true,
  isMainnetGated: false,
};

export const BASE_SEPOLIA: ChainMeta = {
  id: 84532,
  name: "Base Sepolia",
  shortName: "sepolia",
  isTestnet: true,
  isMainnetGated: false,
  explorerUrl: "https://sepolia.basescan.org",
};

export const BASE_MAINNET: ChainMeta = {
  id: 8453,
  name: "Base mainnet",
  shortName: "mainnet",
  isTestnet: false,
  isMainnetGated: true, // UI refuses to enable trading; banner only.
  explorerUrl: "https://basescan.org",
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
