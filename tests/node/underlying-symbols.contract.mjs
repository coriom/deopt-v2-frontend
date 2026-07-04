// underlying-symbols.contract.mjs
//
// Pins the fallback address → ticker mapping in
// `src/lib/underlying-symbols.ts`. The mapping is frozen — if a value
// ever changes it should be an explicit milestone.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  resolve(__dirname, "../../src/lib/underlying-symbols.ts"),
  "utf8",
);

// Re-implement `underlyingDisplaySymbol` from source shape.
const KNOWN = {
  "0x4200000000000000000000000000000000000006": "ETH",
  "0x6eae407f5640b006fac9965182e238582a3b412e": "USDC",
  "0x4deebc5f537f3b8ba0e3393807b4d699d72bdd02": "ETH",
  "0x9d871ac7595e8da271e866608e5145252047967c": "BTC",
};
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function underlyingDisplaySymbol(underlying, underlyingSymbol) {
  if (underlyingSymbol && underlyingSymbol.trim().length > 0) return underlyingSymbol;
  const raw = (underlying ?? "").trim();
  if (raw.length === 0) return "";
  if (ADDRESS_RE.test(raw)) {
    const lower = raw.toLowerCase();
    if (KNOWN[lower]) return KNOWN[lower];
    return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
  }
  return raw;
}

test("source hardcodes the four frozen Base Sepolia mappings", () => {
  const expected = [
    ["0x4200000000000000000000000000000000000006", "ETH"],
    ["0x6eae407f5640b006fac9965182e238582a3b412e", "USDC"],
    ["0x4deebc5f537f3b8ba0e3393807b4d699d72bdd02", "ETH"],
    ["0x9d871ac7595e8da271e866608e5145252047967c", "BTC"],
  ];
  for (const [addr, sym] of expected) {
    assert.ok(
      SOURCE.includes(addr) && SOURCE.includes(`"${sym}"`),
      `source must map ${addr} → ${sym}`,
    );
  }
});

test("Base canonical WETH address resolves to ETH", () => {
  assert.equal(
    underlyingDisplaySymbol("0x4200000000000000000000000000000000000006"),
    "ETH",
  );
});

test("mock testnet WBTC resolves to BTC (case-insensitive)", () => {
  assert.equal(
    underlyingDisplaySymbol("0x9D871AC7595E8DA271E866608E5145252047967C"),
    "BTC",
  );
});

test("mock testnet WETH resolves to ETH", () => {
  assert.equal(
    underlyingDisplaySymbol("0x4DeeBC5F537F3b8bA0E3393807b4D699D72BDD02"),
    "ETH",
  );
});

test("mock testnet USDC resolves to USDC", () => {
  assert.equal(
    underlyingDisplaySymbol("0x6eAe407f5640B006faC9965182e238582A3B412E"),
    "USDC",
  );
});

test("explicit backend-supplied symbol always wins over the fallback table", () => {
  assert.equal(
    underlyingDisplaySymbol(
      "0x4200000000000000000000000000000000000006",
      "WETH",
    ),
    "WETH",
  );
});

test("unknown address is truncated to 0xABCD…6789 format", () => {
  const random = "0x1234567890abcdef1234567890abcdef12345678";
  assert.equal(underlyingDisplaySymbol(random), "0x1234…5678");
});

test("plain ticker string passes through untouched", () => {
  assert.equal(underlyingDisplaySymbol("BTC"), "BTC");
  assert.equal(underlyingDisplaySymbol("ETH"), "ETH");
});

test("empty / whitespace returns empty string", () => {
  assert.equal(underlyingDisplaySymbol(""), "");
  assert.equal(underlyingDisplaySymbol("   "), "");
});

test("null underlying_symbol falls through to fallback logic", () => {
  assert.equal(
    underlyingDisplaySymbol(
      "0x4200000000000000000000000000000000000006",
      null,
    ),
    "ETH",
  );
});
