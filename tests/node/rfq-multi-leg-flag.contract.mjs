// RFQ-MULTI-LEG-FRONTEND-V1 — frontend feature flag contract.
//
// The flag `NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED` gates the multi-leg
// RFQ path in the RFQ / Strategy workspace. Default false. Never
// auto-detected. Never inferred from wallet / network / backend.
//
// Pure-JS re-implementation of `src/lib/rfq-multi-leg-flag.ts` so
// the test survives a repo build break — mirrors the pattern used
// by `options-rfq-flag.contract.mjs`.

import { test } from "node:test";
import assert from "node:assert/strict";

const ENV_KEY = "NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED";

function truthy(v) {
  if (v === null || v === undefined) return false;
  const t = String(v).trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

function isRfqMultiLegEnabled(env) {
  return truthy(env[ENV_KEY]);
}

test("default (unset) → false", () => {
  assert.equal(isRfqMultiLegEnabled({}), false);
});

test("literal 'false' → false", () => {
  assert.equal(
    isRfqMultiLegEnabled({ [ENV_KEY]: "false" }),
    false,
  );
});

test("literal 'true' → true", () => {
  assert.equal(
    isRfqMultiLegEnabled({ [ENV_KEY]: "true" }),
    true,
  );
});

test("'TRUE' (case-insensitive) → true", () => {
  assert.equal(
    isRfqMultiLegEnabled({ [ENV_KEY]: "TRUE" }),
    true,
  );
});

test("'1' → true", () => {
  assert.equal(
    isRfqMultiLegEnabled({ [ENV_KEY]: "1" }),
    true,
  );
});

test("'yes' → true", () => {
  assert.equal(
    isRfqMultiLegEnabled({ [ENV_KEY]: "yes" }),
    true,
  );
});

test("garbage value → false (safe default)", () => {
  assert.equal(
    isRfqMultiLegEnabled({ [ENV_KEY]: "enabled" }),
    false,
  );
  assert.equal(
    isRfqMultiLegEnabled({ [ENV_KEY]: "  " }),
    false,
  );
});

test("env key is the frozen literal", () => {
  assert.equal(ENV_KEY, "NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED");
});
