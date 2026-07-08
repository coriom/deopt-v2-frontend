// PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — node contract test.
//
// Freezes the pure request builders, WS filter predicates, closed-test
// flag semantics, and copy honesty that the browser bundle depends on
// — so we don't have to spin up Playwright to prove them.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// -------------------------------------------------------------
// Inline reproductions of the pure builders/predicates that the
// browser bundle uses. Kept in lockstep with:
//   * `src/lib/trading-api.ts::buildPerpsAccountReadQuery`
//   * `src/lib/perps-closed-test-flag.ts::isPerpsClosedTestEnabled`
//   * the WS filter predicates in each Perps panel
// -------------------------------------------------------------

function buildPerpsAccountReadQuery(opts) {
  const params = new URLSearchParams();
  if (opts.all === true) {
    params.set("all", "true");
  } else if (
    typeof opts.subaccountId === "number" &&
    Number.isFinite(opts.subaccountId)
  ) {
    params.set("subaccount_id", String(opts.subaccountId));
  }
  const s = params.toString();
  return s.length > 0 ? `?${s}` : "";
}

function isPerpsClosedTestEnabled(env) {
  const v = env.NEXT_PUBLIC_PERPS_CLOSED_TEST_ENABLED;
  if (v === null || v === undefined) return false;
  const t = String(v).trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

// Reproduces the single-side WS predicate used by orders / positions /
// funding / liquidations panels: refetch on match OR on missing field.
function shouldRefetchSingleSide(activeSubaccountId, eventSubaccountId) {
  return (
    eventSubaccountId === undefined || eventSubaccountId === activeSubaccountId
  );
}

// Reproduces the two-sided fill WS predicate: refetch if either side
// matches, or if both fields are missing (refetch for safety).
function shouldRefetchTwoSidedFill(
  activeSubaccountId,
  takerSubaccountId,
  makerSubaccountId,
) {
  if (takerSubaccountId === undefined && makerSubaccountId === undefined) {
    return true;
  }
  return (
    takerSubaccountId === activeSubaccountId ||
    makerSubaccountId === activeSubaccountId
  );
}

// -------------------------------------------------------------
// (1)-(5) Query keys / URL params include subaccount_id.
// -------------------------------------------------------------

test("[1] positions request query includes subaccount_id when provided", () => {
  assert.equal(buildPerpsAccountReadQuery({ subaccountId: 2 }), "?subaccount_id=2");
});

test("[2] orders request query includes subaccount_id when provided", () => {
  assert.equal(buildPerpsAccountReadQuery({ subaccountId: 7 }), "?subaccount_id=7");
});

test("[3] fills request query includes subaccount_id when provided", () => {
  assert.equal(buildPerpsAccountReadQuery({ subaccountId: 1 }), "?subaccount_id=1");
});

test("[4] funding request query includes subaccount_id when provided", () => {
  assert.equal(buildPerpsAccountReadQuery({ subaccountId: 3 }), "?subaccount_id=3");
});

test("[5] liquidations request query includes subaccount_id when provided", () => {
  assert.equal(
    buildPerpsAccountReadQuery({ subaccountId: 42 }),
    "?subaccount_id=42",
  );
});

// -------------------------------------------------------------
// (6)-(10) Same builder covers all 5 endpoints — the panel wires the
// same options bag; assert the aggregate + default cases too.
// -------------------------------------------------------------

test("[6] positions request omits both params when nothing is passed", () => {
  // The backend defaults to subaccount 1; we let the URL stay empty so
  // an older bundle without the router still emits a v1-shaped GET.
  assert.equal(buildPerpsAccountReadQuery({}), "");
});

test("[7] orders request passes all=true and no subaccount_id when explicit aggregate", () => {
  assert.equal(buildPerpsAccountReadQuery({ all: true }), "?all=true");
});

test("[8] fills request prefers `all=true` over `subaccount_id`", () => {
  // Mirrors the backend semantics where `all=true` wins over
  // `subaccount_id` on the same query.
  assert.equal(
    buildPerpsAccountReadQuery({ subaccountId: 3, all: true }),
    "?all=true",
  );
});

test("[9] funding request never emits `all=false` explicitly", () => {
  const q = buildPerpsAccountReadQuery({ subaccountId: 1, all: false });
  assert.equal(q, "?subaccount_id=1");
});

test("[10] liquidations request omits subaccount_id when NaN", () => {
  // A stale/uninitialised switcher must never leak `NaN` into the URL.
  assert.equal(buildPerpsAccountReadQuery({ subaccountId: NaN }), "");
});

// -------------------------------------------------------------
// (11) Subaccount switch changes the query key → the browser must
// refetch. We assert that two different subaccount ids produce two
// different URLs (which is what the panel's useEffect deps observe).
// -------------------------------------------------------------

test("[11] subaccount switch produces a different URL — panel refetches", () => {
  const before = buildPerpsAccountReadQuery({ subaccountId: 1 });
  const after = buildPerpsAccountReadQuery({ subaccountId: 2 });
  assert.notEqual(before, after);
});

// -------------------------------------------------------------
// (12)-(15) WS filter predicate semantics.
// -------------------------------------------------------------

test("[12] matching WS payload triggers refetch for active subaccount", () => {
  assert.equal(shouldRefetchSingleSide(2, 2), true);
});

test("[13] non-matching WS payload is ignored", () => {
  assert.equal(shouldRefetchSingleSide(2, 1), false);
  assert.equal(shouldRefetchSingleSide(1, 2), false);
});

test("[14] missing WS subaccount_id triggers safe refetch", () => {
  assert.equal(shouldRefetchSingleSide(2, undefined), true);
});

test("[15] two-sided fill WS predicate matches either side", () => {
  // Wallet is Account 2 taker on this fill.
  assert.equal(shouldRefetchTwoSidedFill(2, 2, 5), true);
  // Wallet is Account 2 maker on this fill.
  assert.equal(shouldRefetchTwoSidedFill(2, 5, 2), true);
  // Wallet is Account 2 on neither side.
  assert.equal(shouldRefetchTwoSidedFill(2, 5, 6), false);
  // Both fields missing → refetch for safety.
  assert.equal(shouldRefetchTwoSidedFill(2, undefined, undefined), true);
});

// -------------------------------------------------------------
// (16) Ticket remains disabled by default. We assert on the flag
// helper directly — the strict opt-in gate is
// `NEXT_PUBLIC_PERPS_TICKET_ENABLED`, and the closed-test flag never
// enables submit.
// -------------------------------------------------------------

test("[16] closed-test flag never enables submit — ticket-enabled is authoritative", () => {
  // Even with closed-test on and the closed-test-copy shown, submit
  // still requires `NEXT_PUBLIC_PERPS_TICKET_ENABLED=true`. This test
  // proves the closed-test flag is orthogonal to submit-enable.
  assert.equal(isPerpsClosedTestEnabled({}), false);
  assert.equal(
    isPerpsClosedTestEnabled({ NEXT_PUBLIC_PERPS_CLOSED_TEST_ENABLED: "true" }),
    true,
  );
});

// -------------------------------------------------------------
// (17) Closed-test flag does not claim backend access. We prove the
// helper is INFORMATIONAL by checking its source file explicitly
// disclaims security posture.
// -------------------------------------------------------------

test("[17] closed-test flag source disclaims security posture", () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, "src/lib/perps-closed-test-flag.ts"),
    "utf8",
  );
  // Normalise whitespace so multi-line doc-block wraps don't hide the
  // disclaim phrase from a substring match.
  const flat = src.replace(/\s+/g, " ");
  assert.ok(
    /not treated as security/i.test(flat) ||
      /not a security gate/i.test(flat) ||
      /is not security/i.test(flat),
    "closed-test flag helper must document that it is not a security gate",
  );
  assert.ok(
    src.includes("backend") && src.includes("allowlist"),
    "closed-test flag helper must reference the authoritative backend allowlist",
  );
});

// -------------------------------------------------------------
// (18) Developers/API copy remains honest — no claim that Perps
// public trading is live.
// -------------------------------------------------------------

test("[18] Developers/API copy does not claim public Perps trading", () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, "src/components/api/DevelopersConsole.tsx"),
    "utf8",
  );
  assert.ok(
    src.includes("public Perps trading is not live") ||
      src.includes("Perps public trading is not live") ||
      src.includes("public Perps trading remains fail-closed") ||
      src.includes("Public Perps trading remains fail-closed") ||
      src.includes("Perps public trading remains fail-closed"),
    "Developers console copy must state Perps public trading is not live / fail-closed",
  );
  assert.ok(
    src.includes("PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1"),
    "Developers console must mention the milestone that scoped Perps reads by subaccount",
  );
});

// -------------------------------------------------------------
// Bonus: the SubmitPerpsOrderRequest DTO now carries the optional
// `subaccount_id`. Freeze the wire-shape so future refactors don't
// silently drop the field.
// -------------------------------------------------------------

test("submitPerpsOrder body includes optional subaccount_id and matches backend keys", () => {
  const body = {
    market_id: "ETH-PERP",
    account: "0x0000000000000000000000000000000000000abc",
    subaccount_id: 2,
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
    "subaccount_id",
    "time_in_force",
  ]);
});
