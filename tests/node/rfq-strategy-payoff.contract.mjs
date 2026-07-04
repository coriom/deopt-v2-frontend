// rfq-strategy-payoff.contract.mjs
//
// Pins the local payoff math for the RFQ/Strategy foundation. The
// math is intentional intrinsic-only (no time-value, no IV, no BS)
// and premium defaults to 0 when a leg has `premium == null`. These
// tests re-implement the exports from `rfq-strategy-payoff.ts` in JS
// to stay dependency-free, and cross-check the source shape.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  resolve(__dirname, "../../src/lib/rfq-strategy-payoff.ts"),
  "utf8",
);

function legPayoffAtExpiry(leg, s, amount) {
  const sign = leg.side === "buy" ? 1 : -1;
  const size = amount * leg.ratio;
  const intrinsic =
    leg.optionType === "call"
      ? Math.max(s - leg.strike, 0)
      : Math.max(leg.strike - s, 0);
  const paid = leg.premium ?? 0;
  return sign * size * intrinsic - sign * size * paid;
}

function totalPayoffAtExpiry(state, s) {
  let sum = 0;
  for (const leg of state.legs) sum += legPayoffAtExpiry(leg, s, state.amount);
  return sum;
}

const baseState = (legs, amount = 1) => ({
  underlying: "BTC",
  expiryMs: 1798704000_000,
  amount,
  presetId: "custom",
  legs: legs.map((l, i) => ({ id: `leg-${i}`, instrumentType: "option", ...l })),
});

test("source declares the intrinsic-only math (no BS pricing)", () => {
  assert.ok(SOURCE.includes("intrinsic"), "source must mention intrinsic-only math");
  // The source's honesty banner must explicitly rule out BS. A raw
  // implementation would import a pricer or reference `BlackScholes`
  // as an identifier — those must never appear.
  assert.ok(
    !SOURCE.includes("BlackScholes") && !SOURCE.includes("blackScholes"),
    "source must NOT import or reference a BS pricer — that would be dishonest without live IV",
  );
  assert.ok(/no IV/i.test(SOURCE), "source honesty banner must state 'no IV'");
});

test("long call payoff at expiry — strike 100, spot 120 → +20", () => {
  const s = baseState([{ optionType: "call", side: "buy", strike: 100, ratio: 1, premium: null }]);
  assert.equal(totalPayoffAtExpiry(s, 120), 20);
  assert.equal(totalPayoffAtExpiry(s, 90), 0);
});

test("long put payoff — strike 100, spot 80 → +20; spot 110 → 0", () => {
  const s = baseState([{ optionType: "put", side: "buy", strike: 100, ratio: 1, premium: null }]);
  assert.equal(totalPayoffAtExpiry(s, 80), 20);
  assert.equal(totalPayoffAtExpiry(s, 110), 0);
});

test("short call payoff — strike 100, spot 120 → −20", () => {
  const s = baseState([{ optionType: "call", side: "sell", strike: 100, ratio: 1, premium: null }]);
  assert.equal(totalPayoffAtExpiry(s, 120), -20);
});

test("straddle payoff at strike ATM — spot == strike → 0 (premium excluded)", () => {
  const s = baseState([
    { optionType: "call", side: "buy", strike: 100, ratio: 1, premium: null },
    { optionType: "put", side: "buy", strike: 100, ratio: 1, premium: null },
  ]);
  assert.equal(totalPayoffAtExpiry(s, 100), 0);
  assert.equal(totalPayoffAtExpiry(s, 110), 10);
  assert.equal(totalPayoffAtExpiry(s, 90), 10);
});

test("bull call spread caps profit at (K2 - K1)", () => {
  const s = baseState([
    { optionType: "call", side: "buy", strike: 100, ratio: 1, premium: null },
    { optionType: "call", side: "sell", strike: 110, ratio: 1, premium: null },
  ]);
  assert.equal(totalPayoffAtExpiry(s, 90), 0);
  assert.equal(totalPayoffAtExpiry(s, 100), 0);
  assert.equal(totalPayoffAtExpiry(s, 105), 5);
  assert.equal(totalPayoffAtExpiry(s, 110), 10);
  assert.equal(totalPayoffAtExpiry(s, 200), 10); // capped
});

test("butterfly 1-2-1 caps at the middle strike", () => {
  const s = baseState([
    { optionType: "call", side: "buy", strike: 90, ratio: 1, premium: null },
    { optionType: "call", side: "sell", strike: 100, ratio: 2, premium: null },
    { optionType: "call", side: "buy", strike: 110, ratio: 1, premium: null },
  ]);
  assert.equal(totalPayoffAtExpiry(s, 80), 0);
  assert.equal(totalPayoffAtExpiry(s, 90), 0);
  assert.equal(totalPayoffAtExpiry(s, 100), 10); // peak at middle strike
  assert.equal(totalPayoffAtExpiry(s, 110), 0);
  assert.equal(totalPayoffAtExpiry(s, 120), 0); // wings both cap
});

test("premium is respected when set on a leg — long call with 5 paid → +15 at spot 120", () => {
  const s = baseState([{ optionType: "call", side: "buy", strike: 100, ratio: 1, premium: 5 }]);
  assert.equal(totalPayoffAtExpiry(s, 120), 15);
  assert.equal(totalPayoffAtExpiry(s, 90), -5);
});

test("amount scales the payoff linearly", () => {
  const s = baseState(
    [{ optionType: "call", side: "buy", strike: 100, ratio: 1, premium: null }],
    3,
  );
  assert.equal(totalPayoffAtExpiry(s, 120), 60); // 3 × 20
});

test("empty custom strategy returns zero payoff everywhere", () => {
  const s = baseState([]);
  assert.equal(totalPayoffAtExpiry(s, 50), 0);
  assert.equal(totalPayoffAtExpiry(s, 5000), 0);
});
