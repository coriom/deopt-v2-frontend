// SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1 — private WS payload wire contract.
//
// Freezes the safe merge/refetch predicates shared with the frontend
// consumers (`OpenOrdersPanel`, `ConditionalOrdersPanel`, `FillsPanel`,
// `HistoryShell`):
//
//   * subaccount_id matches active   → merge / show banner.
//   * subaccount_id mismatches       → ignore.
//   * subaccount_id missing          → refetch (older backend).
//
// For fills, the buyer/seller-side subaccount is chosen by the delta's
// `side` field. The predicate is symmetric.
//
// Pure JS re-implementation of the four TS payload discriminants so the
// test survives an app build break.

import { test } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------
// Predicates mirroring the app-side logic in
// OpenOrdersPanel / ConditionalOrdersPanel / FillsPanel /
// HistoryShell.
// ---------------------------------------------------------------------

/** True when the order/conditional-order delta should be merged into
 *  the local cache scoped to `activeSubaccountId`. */
function shouldMergeSubaccountedDelta(delta, activeSubaccountId) {
  if (delta.subaccount_id === undefined) return "refetch";
  return delta.subaccount_id === activeSubaccountId ? "merge" : "ignore";
}

/** For a fill event, choose the receiver's side subaccount and
 *  compare against active. */
function fillDeltaDecision(delta, activeSubaccountId) {
  if (
    delta.buyer_subaccount_id === undefined &&
    delta.seller_subaccount_id === undefined
  ) {
    return "refetch";
  }
  const mySide =
    delta.side === "buy"
      ? delta.buyer_subaccount_id
      : delta.seller_subaccount_id;
  if (mySide === undefined) return "refetch";
  return mySide === activeSubaccountId ? "refetch" : "ignore";
}

/** History banner: fire when the delta belongs to the active
 *  subaccount OR the subaccount id is missing (safe default). */
function historyBannerDecision(payload, activeSubaccountId) {
  let subaccountId;
  if (payload.type === "order_updated") {
    subaccountId = payload.subaccount_id;
  } else if (payload.type === "fill_created") {
    subaccountId =
      payload.side === "buy"
        ? payload.buyer_subaccount_id
        : payload.seller_subaccount_id;
  } else if (
    payload.type === "conditional_order_updated" ||
    payload.type === "attachment_plan_updated"
  ) {
    subaccountId = payload.subaccount_id;
  }
  return subaccountId === undefined || subaccountId === activeSubaccountId
    ? "show"
    : "skip";
}

// ---------------------------------------------------------------------
// order_updated
// ---------------------------------------------------------------------

test("order_updated with matching subaccount merges", () => {
  const delta = {
    type: "order_updated",
    order_id: "o1",
    option_series_id: "s",
    subaccount_id: 2,
    status: "open",
    remaining_size_1e8: "100",
    size_1e8: "100",
  };
  assert.equal(shouldMergeSubaccountedDelta(delta, 2), "merge");
});

test("order_updated with mismatched subaccount ignores", () => {
  const delta = {
    type: "order_updated",
    order_id: "o1",
    option_series_id: "s",
    subaccount_id: 1,
    status: "open",
    remaining_size_1e8: "100",
    size_1e8: "100",
  };
  assert.equal(shouldMergeSubaccountedDelta(delta, 2), "ignore");
});

test("order_updated without subaccount refetches", () => {
  const delta = {
    type: "order_updated",
    order_id: "o1",
    option_series_id: "s",
    status: "open",
    remaining_size_1e8: "100",
    size_1e8: "100",
  };
  assert.equal(shouldMergeSubaccountedDelta(delta, 2), "refetch");
});

// ---------------------------------------------------------------------
// conditional_order_updated (same predicate as order_updated)
// ---------------------------------------------------------------------

test("conditional_order_updated with matching subaccount merges", () => {
  const delta = {
    type: "conditional_order_updated",
    conditional_order_id: "c1",
    option_series_id: "s",
    subaccount_id: 2,
    status: "armed",
    child_order_id: null,
    oco_group_id: null,
    failure_code: null,
  };
  assert.equal(shouldMergeSubaccountedDelta(delta, 2), "merge");
});

test("conditional_order_updated with mismatched subaccount ignores", () => {
  const delta = {
    type: "conditional_order_updated",
    conditional_order_id: "c1",
    option_series_id: "s",
    subaccount_id: 1,
    status: "armed",
    child_order_id: null,
    oco_group_id: null,
    failure_code: null,
  };
  assert.equal(shouldMergeSubaccountedDelta(delta, 2), "ignore");
});

// ---------------------------------------------------------------------
// fill_created
// ---------------------------------------------------------------------

test("fill_created as buyer with matching buyer_subaccount_id refetches", () => {
  const delta = {
    type: "fill_created",
    fill_id: "f1",
    option_series_id: "s",
    order_id: "o",
    side: "buy",
    price_1e8: "1",
    size_1e8: "1",
    created_at_ms: 0,
    buyer_subaccount_id: 2,
    seller_subaccount_id: 1,
  };
  assert.equal(fillDeltaDecision(delta, 2), "refetch");
});

test("fill_created as seller with matching seller_subaccount_id refetches", () => {
  const delta = {
    type: "fill_created",
    fill_id: "f1",
    option_series_id: "s",
    order_id: "o",
    side: "sell",
    price_1e8: "1",
    size_1e8: "1",
    created_at_ms: 0,
    buyer_subaccount_id: 1,
    seller_subaccount_id: 2,
  };
  assert.equal(fillDeltaDecision(delta, 2), "refetch");
});

test("fill_created as buyer with mismatched buyer_subaccount_id ignores", () => {
  const delta = {
    type: "fill_created",
    fill_id: "f1",
    option_series_id: "s",
    order_id: "o",
    side: "buy",
    price_1e8: "1",
    size_1e8: "1",
    created_at_ms: 0,
    buyer_subaccount_id: 1,
    seller_subaccount_id: 2,
  };
  // Wallet is on the buy side; buyer_subaccount_id=1 ≠ active=2.
  assert.equal(fillDeltaDecision(delta, 2), "ignore");
});

test("fill_created without any subaccount ids refetches", () => {
  const delta = {
    type: "fill_created",
    fill_id: "f1",
    option_series_id: "s",
    order_id: "o",
    side: "buy",
    price_1e8: "1",
    size_1e8: "1",
    created_at_ms: 0,
  };
  assert.equal(fillDeltaDecision(delta, 2), "refetch");
});

// ---------------------------------------------------------------------
// History banner predicate
// ---------------------------------------------------------------------

test("history banner shows for matching subaccount order event", () => {
  assert.equal(
    historyBannerDecision(
      { type: "order_updated", subaccount_id: 2 },
      2,
    ),
    "show",
  );
});

test("history banner skips for mismatched subaccount order event", () => {
  assert.equal(
    historyBannerDecision(
      { type: "order_updated", subaccount_id: 1 },
      2,
    ),
    "skip",
  );
});

test("history banner shows when subaccount is missing (safe refetch signal)", () => {
  assert.equal(
    historyBannerDecision({ type: "order_updated" }, 2),
    "show",
  );
});

test("history banner uses buyer_subaccount_id when receiver is buyer", () => {
  assert.equal(
    historyBannerDecision(
      {
        type: "fill_created",
        side: "buy",
        buyer_subaccount_id: 2,
        seller_subaccount_id: 1,
      },
      2,
    ),
    "show",
  );
  assert.equal(
    historyBannerDecision(
      {
        type: "fill_created",
        side: "buy",
        buyer_subaccount_id: 1,
        seller_subaccount_id: 2,
      },
      2,
    ),
    "skip",
  );
});

test("history banner uses seller_subaccount_id when receiver is seller", () => {
  assert.equal(
    historyBannerDecision(
      {
        type: "fill_created",
        side: "sell",
        buyer_subaccount_id: 1,
        seller_subaccount_id: 2,
      },
      2,
    ),
    "show",
  );
});
