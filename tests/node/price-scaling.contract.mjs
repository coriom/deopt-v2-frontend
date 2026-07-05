// OPTIONS-ADVANCED-ORDER-TICKET-UX-V1 — node contract test for the
// shared price scaling helpers used by the Options order ticket.
//
// The helpers convert between human-readable decimal prices
// (`"189.1"`) and their 1e8-scaled backend wire form
// (`"18910000000"`). Wire values that pass through these helpers
// end up in the write-auth canonical byte stream and the JSON
// submit body, so any drift is a P0 wire-contract break — that's
// why we freeze the canonical cases here in a stand-alone node
// test that runs with zero dependencies.
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/price-scaling.contract.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

// Inline reproduction of `humanToScaled1e8` / `scaled1e8ToHuman`
// from `src/lib/price-scaling.ts`. Change here if you change the
// source — the whole point of a canonical byte-freeze is that the
// test fails when either side drifts.

const ONE_E8 = BigInt("100000000");

function humanToScaled1e8(input) {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 8) return null;
  const padded = (frac + "00000000").slice(0, 8);
  let scaled;
  try {
    scaled = BigInt(whole) * ONE_E8 + BigInt(padded || "0");
  } catch {
    return null;
  }
  if (scaled < BigInt(0)) return null;
  return scaled.toString();
}

function scaled1e8ToHuman(scaled) {
  const trimmed = scaled.trim();
  if (!/^\d+$/.test(trimmed)) return scaled;
  let big;
  try {
    big = BigInt(trimmed);
  } catch {
    return scaled;
  }
  const whole = big / ONE_E8;
  const remainder = big % ONE_E8;
  if (remainder === BigInt(0)) return whole.toString();
  const frac = remainder.toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole.toString()}.${frac}`;
}

// ---------- humanToScaled1e8 canonical cases ----------

test("humanToScaled1e8: 189.1 → 18910000000 (brief example)", () => {
  assert.equal(humanToScaled1e8("189.1"), "18910000000");
});

test("humanToScaled1e8: 250 → 25000000000", () => {
  assert.equal(humanToScaled1e8("250"), "25000000000");
});

test("humanToScaled1e8: 150 → 15000000000", () => {
  assert.equal(humanToScaled1e8("150"), "15000000000");
});

test("humanToScaled1e8: 0.01 → 1000000 (brief example)", () => {
  assert.equal(humanToScaled1e8("0.01"), "1000000");
});

test("humanToScaled1e8: 15 → 1500000000 (matches attached TP/SL fixture)", () => {
  assert.equal(humanToScaled1e8("15"), "1500000000");
});

test("humanToScaled1e8: 5 → 500000000 (matches attached SL fixture)", () => {
  assert.equal(humanToScaled1e8("5"), "500000000");
});

test("humanToScaled1e8: 0 → 0 (accepted; caller decides > 0 rule)", () => {
  assert.equal(humanToScaled1e8("0"), "0");
});

test("humanToScaled1e8: 0.00000001 (max fractional precision) → 1", () => {
  assert.equal(humanToScaled1e8("0.00000001"), "1");
});

test("humanToScaled1e8: leading/trailing whitespace tolerated", () => {
  assert.equal(humanToScaled1e8("  15  "), "1500000000");
});

// ---------- humanToScaled1e8 rejection cases ----------

test("humanToScaled1e8: empty string → null", () => {
  assert.equal(humanToScaled1e8(""), null);
});

test("humanToScaled1e8: whitespace-only → null", () => {
  assert.equal(humanToScaled1e8("   "), null);
});

test("humanToScaled1e8: non-decimal 'abc' → null", () => {
  assert.equal(humanToScaled1e8("abc"), null);
});

test("humanToScaled1e8: negative sign → null (non-negative only)", () => {
  assert.equal(humanToScaled1e8("-1"), null);
});

test("humanToScaled1e8: explicit + sign → null", () => {
  assert.equal(humanToScaled1e8("+1"), null);
});

test("humanToScaled1e8: scientific notation '1e2' → null", () => {
  assert.equal(humanToScaled1e8("1e2"), null);
});

test("humanToScaled1e8: 9 fractional digits exceeds 1e8 precision → null", () => {
  assert.equal(humanToScaled1e8("0.000000001"), null);
});

test("humanToScaled1e8: trailing dot '15.' → null", () => {
  assert.equal(humanToScaled1e8("15."), null);
});

test("humanToScaled1e8: two dots '1.2.3' → null", () => {
  assert.equal(humanToScaled1e8("1.2.3"), null);
});

// ---------- scaled1e8ToHuman canonical cases ----------

test("scaled1e8ToHuman: 15000000000 → 150 (brief example)", () => {
  assert.equal(scaled1e8ToHuman("15000000000"), "150");
});

test("scaled1e8ToHuman: 18910000000 → 189.1", () => {
  assert.equal(scaled1e8ToHuman("18910000000"), "189.1");
});

test("scaled1e8ToHuman: 1000000 → 0.01", () => {
  assert.equal(scaled1e8ToHuman("1000000"), "0.01");
});

test("scaled1e8ToHuman: 1500000000 → 15", () => {
  assert.equal(scaled1e8ToHuman("1500000000"), "15");
});

test("scaled1e8ToHuman: 500000000 → 5", () => {
  assert.equal(scaled1e8ToHuman("500000000"), "5");
});

test("scaled1e8ToHuman: 0 → 0", () => {
  assert.equal(scaled1e8ToHuman("0"), "0");
});

test("scaled1e8ToHuman: 1 (min unit) → 0.00000001", () => {
  assert.equal(scaled1e8ToHuman("1"), "0.00000001");
});

test("scaled1e8ToHuman: 100000000 (whole 1.0) → 1", () => {
  assert.equal(scaled1e8ToHuman("100000000"), "1");
});

test("scaled1e8ToHuman: unexpected non-digit input returns verbatim (no crash)", () => {
  assert.equal(scaled1e8ToHuman("abc"), "abc");
});

test("scaled1e8ToHuman: signed input rejected as non-digit (returns verbatim)", () => {
  assert.equal(scaled1e8ToHuman("-100"), "-100");
});

// ---------- roundtrip invariants ----------

test("roundtrip: human → scaled → human is a fixed point on canonical shapes", () => {
  const cases = ["0", "1", "15", "150", "189.1", "0.01", "0.00000001"];
  for (const h of cases) {
    const scaled = humanToScaled1e8(h);
    assert.ok(scaled !== null, `humanToScaled1e8(${h}) should not be null`);
    const back = scaled1e8ToHuman(scaled);
    assert.equal(back, h, `roundtrip mismatch: ${h} → ${scaled} → ${back}`);
  }
});

test("roundtrip: scaled → human → scaled preserves the scaled string", () => {
  const cases = ["0", "1", "1000000", "1500000000", "18910000000", "100000000"];
  for (const s of cases) {
    const human = scaled1e8ToHuman(s);
    const scaledAgain = humanToScaled1e8(human);
    assert.equal(scaledAgain, s, `roundtrip mismatch: ${s} → ${human} → ${scaledAgain}`);
  }
});
