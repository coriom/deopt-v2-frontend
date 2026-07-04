// Frontend fallback mapping from well-known Base Sepolia underlying
// addresses to human ticker symbols.
//
// The backend Product record may or may not carry `underlying_symbol`;
// when it doesn't, the raw hex address flows through to the UI (e.g.
// `0x4200000000000000000000000000000000000006`). This helper gives the
// terminal a clean fallback so the underlying selector reads `BTC` or
// `ETH` instead of a wall of hex.
//
// Frozen values only — never inject a symbol we haven't cross-checked.

/**
 * Frozen Base Sepolia address → symbol mapping. Keys are lowercased on
 * lookup, so callers may pass either checksum or all-lower hex.
 */
const KNOWN_UNDERLYING_SYMBOLS: Readonly<Record<string, string>> = {
  // Base canonical WETH pre-deploy — how the OptionProductRegistry
  // references ETH on-chain.
  "0x4200000000000000000000000000000000000006": "ETH",
  // Mock testnet collateral tokens shipped with the public faucet
  // (`TESTNET-PUBLIC-FAUCET-CONTRACT-V1`).
  "0x6eae407f5640b006fac9965182e238582a3b412e": "USDC",
  "0x4deebc5f537f3b8ba0e3393807b4d699d72bdd02": "ETH",
  "0x9d871ac7595e8da271e866608e5145252047967c": "BTC",
} as const;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Resolve a display symbol for a product `underlying` field.
 *
 * Order:
 *   1. Explicit backend-provided `underlying_symbol` (never overridden).
 *   2. Frozen `KNOWN_UNDERLYING_SYMBOLS` lookup if the raw value is a
 *      recognised Base Sepolia hex address.
 *   3. Truncated `0xABCD…6789` if the raw value is any 40-hex address.
 *   4. Raw value as-is (for cases where the backend already sends a
 *      symbol like `"BTC"`).
 */
export function underlyingDisplaySymbol(
  underlying: string,
  underlyingSymbol?: string | null,
): string {
  if (underlyingSymbol && underlyingSymbol.trim().length > 0) {
    return underlyingSymbol;
  }
  const raw = (underlying ?? "").trim();
  if (raw.length === 0) return "";
  if (ADDRESS_RE.test(raw)) {
    const lower = raw.toLowerCase();
    const known = KNOWN_UNDERLYING_SYMBOLS[lower];
    if (known) return known;
    return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
  }
  return raw;
}
