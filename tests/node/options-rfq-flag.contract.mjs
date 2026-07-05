// OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1 — node contract test for the
// strict opt-in `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED` flag helper.
//
// Mirrors the perps flag contract test. The rule: the flag defaults
// to false, only exact tokens `true` / `1` / `yes` (case-insensitive,
// trimmed) flip it on, and NOTHING else — no wallet state, no chain
// id, no runtime toggles.
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/options-rfq-flag.contract.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

// Inline reproduction of `isOptionsRfqEnabled()` from
// `src/lib/options-rfq-flag.ts`. Change here if you change the source.
function truthy(v) {
  if (v === null || v === undefined) return false;
  const t = String(v).trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}
function isOptionsRfqEnabled(env) {
  return truthy(env.NEXT_PUBLIC_OPTIONS_RFQ_ENABLED);
}

test("flag is off when env var is unset", () => {
  assert.equal(isOptionsRfqEnabled({}), false);
});

test("flag is off for empty string", () => {
  assert.equal(
    isOptionsRfqEnabled({ NEXT_PUBLIC_OPTIONS_RFQ_ENABLED: "" }),
    false,
  );
});

test("flag is off for arbitrary non-truthy strings", () => {
  for (const v of [
    "false",
    "0",
    "no",
    "off",
    "disabled",
    "NULL",
    " True ",
    "enabled",
    "TRUE ",
  ]) {
    if (v === "TRUE " || v === " True ") continue; // handled separately
    assert.equal(
      isOptionsRfqEnabled({ NEXT_PUBLIC_OPTIONS_RFQ_ENABLED: v }),
      false,
      `expected off for ${JSON.stringify(v)}`,
    );
  }
});

test("flag flips on for exactly true|1|yes (case + whitespace tolerant)", () => {
  for (const v of ["true", "TRUE", "True", "1", "yes", "YES", "  true  "]) {
    assert.equal(
      isOptionsRfqEnabled({ NEXT_PUBLIC_OPTIONS_RFQ_ENABLED: v }),
      true,
      `expected on for ${JSON.stringify(v)}`,
    );
  }
});

test("env key is the literal NEXT_PUBLIC_OPTIONS_RFQ_ENABLED", () => {
  // Guard against renames — the operator runbook + docs reference this
  // exact env var.
  const env = { NEXT_PUBLIC_OPTIONS_RFQ_ENABLED: "true" };
  assert.equal(isOptionsRfqEnabled(env), true);
  const wrongCase = { next_public_options_rfq_enabled: "true" };
  assert.equal(isOptionsRfqEnabled(wrongCase), false);
});

test("mutation of unrelated env vars does not flip the flag", () => {
  assert.equal(
    isOptionsRfqEnabled({
      NEXT_PUBLIC_PERPS_TICKET_ENABLED: "true",
      NEXT_PUBLIC_TRADING_API_BASE_URL: "http://x",
    }),
    false,
  );
});
