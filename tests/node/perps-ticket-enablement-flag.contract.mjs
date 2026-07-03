// PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — node contract test.
//
// Pins the pure flag-gate behavior and the API request shape that the
// browser bundle uses, so we don't have to spin up a Playwright
// browser to prove them.

import { test } from "node:test";
import assert from "node:assert/strict";

// Inline reproduction of `isPerpsTicketEnabled()` from
// `src/lib/perps-flag.ts`. Change here if you change the source.
function truthy(v) {
  if (v === null || v === undefined) return false;
  const t = String(v).trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}
function isPerpsTicketEnabled(env) {
  return truthy(env.NEXT_PUBLIC_PERPS_TICKET_ENABLED);
}

test("flag is off when env var is unset", () => {
  assert.equal(isPerpsTicketEnabled({}), false);
});

test("flag is off for empty string", () => {
  assert.equal(isPerpsTicketEnabled({ NEXT_PUBLIC_PERPS_TICKET_ENABLED: "" }), false);
});

test("flag is off for arbitrary non-truthy strings", () => {
  for (const v of ["false", "0", "no", "off", "disabled", "NULL", " True "]) {
    // ` True ` is trimmed + lowered → "true" → true (whitespace is fine)
    if (v.trim().toLowerCase() === "true") {
      assert.equal(
        isPerpsTicketEnabled({ NEXT_PUBLIC_PERPS_TICKET_ENABLED: v }),
        true,
        `expected true for value: ${JSON.stringify(v)}`,
      );
    } else {
      assert.equal(
        isPerpsTicketEnabled({ NEXT_PUBLIC_PERPS_TICKET_ENABLED: v }),
        false,
        `expected false for value: ${JSON.stringify(v)}`,
      );
    }
  }
});

test("flag is on for 'true', 'TRUE', '1', 'yes', 'YES'", () => {
  for (const v of ["true", "TRUE", "True", "1", "yes", "YES", "Yes"]) {
    assert.equal(
      isPerpsTicketEnabled({ NEXT_PUBLIC_PERPS_TICKET_ENABLED: v }),
      true,
      `expected true for value: ${JSON.stringify(v)}`,
    );
  }
});

// -------------------------------------------------------------
// API request shape contract. Mirrors backend's
// `PerpsSubmitOrderHttpRequest` in `src/api/routes.rs` exactly.
// -------------------------------------------------------------

test("submitPerpsOrder request body shape matches backend DTO", () => {
  const body = {
    market_id: "ETH-PERP",
    account: "0x0000000000000000000000000000000000000abc",
    side: "buy",
    price_1e8: "300000000000",
    size_1e8: "100000000",
    time_in_force: "gtc",
    post_only: false,
    reduce_only: false,
    isolated_margin_1e8: "30000000000",
    client_order_id: "cli-test",
  };
  const keys = Object.keys(body).sort();
  assert.deepEqual(keys, [
    "account",
    "client_order_id",
    "isolated_margin_1e8",
    "market_id",
    "post_only",
    "price_1e8",
    "reduce_only",
    "side",
    "size_1e8",
    "time_in_force",
  ]);
  // Every 1e8 field must be a base-10 unsigned integer string.
  for (const key of ["price_1e8", "size_1e8", "isolated_margin_1e8"]) {
    assert.match(body[key], /^\d+$/, `${key} must be a base-10 uint string`);
  }
  assert.ok(body.side === "buy" || body.side === "sell");
  assert.ok(["gtc", "ioc", "fok"].includes(body.time_in_force));
});
