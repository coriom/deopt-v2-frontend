// OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — node contract test
// for the execution-mode routing helper. Freezes the truth table:
//
//   * 0 legs                          → empty
//   * 1 leg + auto                    → book
//   * 2+ legs + auto                  → rfq_multileg_blocked
//   * 1 leg + book                    → book
//   * 2+ legs + book                  → book_blocked_multileg
//   * 1 leg + rfq (rfqEnabled=true)   → rfq_single
//   * 1 leg + rfq (rfqEnabled=false)  → rfq_disabled
//   * 2+ legs + rfq                   → rfq_multileg_blocked
//
// Inline reproduces `resolveExecutionMode` from
// `src/lib/execution-mode.ts`. Change here if you change the source.
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/execution-mode.contract.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

function resolveExecutionMode({ requestedMode, selectedLegs, rfqEnabled }) {
  const isMulti = selectedLegs.length > 1;
  const isEmpty = selectedLegs.length === 0;
  if (requestedMode === "book") {
    if (isEmpty) return { kind: "empty" };
    if (isMulti) return { kind: "book_blocked_multileg" };
    return { kind: "book", leg: selectedLegs[0] };
  }
  if (requestedMode === "rfq") {
    if (isMulti) return { kind: "rfq_multileg_blocked" };
    if (isEmpty) return { kind: "rfq_disabled" };
    if (!rfqEnabled) return { kind: "rfq_disabled" };
    return { kind: "rfq_single", leg: selectedLegs[0] };
  }
  if (isEmpty) return { kind: "empty" };
  if (!isMulti) return { kind: "book", leg: selectedLegs[0] };
  return { kind: "rfq_multileg_blocked" };
}

function fakeLeg(overrides = {}) {
  return {
    seriesId: overrides.seriesId ?? "0xabc",
    underlying: overrides.underlying ?? "ETH",
    expiry: overrides.expiry ?? "2026-07-25",
    strike: overrides.strike ?? "1650",
    optionType: overrides.optionType ?? "call",
    side: overrides.side ?? "buy",
    sourcePriceSide: overrides.sourcePriceSide ?? "ask",
    displayPrice: overrides.displayPrice,
    ratio: overrides.ratio ?? "1",
  };
}

test("empty leg list resolves to `empty`", () => {
  const r = resolveExecutionMode({
    requestedMode: "auto",
    selectedLegs: [],
    rfqEnabled: false,
  });
  assert.deepEqual(r, { kind: "empty" });
});

test("empty leg list resolves to `empty` under auto / book (rfq surfaces disabled)", () => {
  for (const m of ["auto", "book"]) {
    for (const rfq of [true, false]) {
      const r = resolveExecutionMode({
        requestedMode: m,
        selectedLegs: [],
        rfqEnabled: rfq,
      });
      assert.deepEqual(r, { kind: "empty" }, `${m} with rfqEnabled=${rfq}`);
    }
  }
  for (const rfq of [true, false]) {
    const r = resolveExecutionMode({
      requestedMode: "rfq",
      selectedLegs: [],
      rfqEnabled: rfq,
    });
    assert.deepEqual(
      r,
      { kind: "rfq_disabled" },
      `rfq with rfqEnabled=${rfq}`,
    );
  }
});

test("1 leg + auto → book with the leg attached", () => {
  const leg = fakeLeg();
  const r = resolveExecutionMode({
    requestedMode: "auto",
    selectedLegs: [leg],
    rfqEnabled: false,
  });
  assert.equal(r.kind, "book");
  assert.equal(r.leg, leg);
});

test("2 legs + auto → rfq_multileg_blocked (backend atomic RFQ not live)", () => {
  const legs = [fakeLeg({ seriesId: "0x1" }), fakeLeg({ seriesId: "0x2" })];
  const r = resolveExecutionMode({
    requestedMode: "auto",
    selectedLegs: legs,
    rfqEnabled: false,
  });
  assert.deepEqual(r, { kind: "rfq_multileg_blocked" });
});

test("2 legs + auto stays blocked even when rfqEnabled=true (multi-leg not live)", () => {
  const legs = [fakeLeg({ seriesId: "0x1" }), fakeLeg({ seriesId: "0x2" })];
  const r = resolveExecutionMode({
    requestedMode: "auto",
    selectedLegs: legs,
    rfqEnabled: true,
  });
  assert.deepEqual(r, { kind: "rfq_multileg_blocked" });
});

test("1 leg + book → book with the leg attached", () => {
  const leg = fakeLeg();
  const r = resolveExecutionMode({
    requestedMode: "book",
    selectedLegs: [leg],
    rfqEnabled: false,
  });
  assert.equal(r.kind, "book");
  assert.equal(r.leg, leg);
});

test("2 legs + book → book_blocked_multileg", () => {
  const legs = [fakeLeg({ seriesId: "0x1" }), fakeLeg({ seriesId: "0x2" })];
  const r = resolveExecutionMode({
    requestedMode: "book",
    selectedLegs: legs,
    rfqEnabled: false,
  });
  assert.deepEqual(r, { kind: "book_blocked_multileg" });
});

test("1 leg + rfq (rfqEnabled=true) → rfq_single", () => {
  const leg = fakeLeg();
  const r = resolveExecutionMode({
    requestedMode: "rfq",
    selectedLegs: [leg],
    rfqEnabled: true,
  });
  assert.equal(r.kind, "rfq_single");
  assert.equal(r.leg, leg);
});

test("1 leg + rfq (rfqEnabled=false) → rfq_disabled", () => {
  const leg = fakeLeg();
  const r = resolveExecutionMode({
    requestedMode: "rfq",
    selectedLegs: [leg],
    rfqEnabled: false,
  });
  assert.deepEqual(r, { kind: "rfq_disabled" });
});

test("2 legs + rfq → rfq_multileg_blocked regardless of rfqEnabled", () => {
  const legs = [fakeLeg({ seriesId: "0x1" }), fakeLeg({ seriesId: "0x2" })];
  for (const rfq of [true, false]) {
    const r = resolveExecutionMode({
      requestedMode: "rfq",
      selectedLegs: legs,
      rfqEnabled: rfq,
    });
    assert.deepEqual(r, { kind: "rfq_multileg_blocked" });
  }
});

test("3 legs + auto still blocks (multi-leg is 2+ legs)", () => {
  const legs = [
    fakeLeg({ seriesId: "0x1" }),
    fakeLeg({ seriesId: "0x2" }),
    fakeLeg({ seriesId: "0x3" }),
  ];
  const r = resolveExecutionMode({
    requestedMode: "auto",
    selectedLegs: legs,
    rfqEnabled: false,
  });
  assert.deepEqual(r, { kind: "rfq_multileg_blocked" });
});

test("legKey: same series + same side collide (toggle-remove target)", () => {
  const a = { seriesId: "0xabc", sourcePriceSide: "ask" };
  const b = { seriesId: "0xabc", sourcePriceSide: "ask" };
  const legKey = (l) => `${l.seriesId}|${l.sourcePriceSide}`;
  assert.equal(legKey(a), legKey(b));
});

test("legKey: same series + different side do NOT collide (spread building)", () => {
  const legKey = (l) => `${l.seriesId}|${l.sourcePriceSide}`;
  assert.notEqual(
    legKey({ seriesId: "0xabc", sourcePriceSide: "ask" }),
    legKey({ seriesId: "0xabc", sourcePriceSide: "bid" }),
  );
});
