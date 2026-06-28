// HISTORY-LIFECYCLE-V2 — wire-contract tests for the conditional-
// history helper module. We re-implement the helpers in pure JS so
// the test never imports React or fetch and stays runnable under
// `node --test`. Keep this file in lock-step with
// `src/lib/history-conditional.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";

const TERMINAL = new Set(["triggered", "completed", "cancelled", "failed", "expired"]);

function isTerminalConditionalStatus(status) {
  return TERMINAL.has(status);
}

function rangeSinceMs(range, nowMs) {
  switch (range) {
    case "last_day":     return nowMs - 24 * 60 * 60 * 1000;
    case "last_week":    return nowMs - 7 * 24 * 60 * 60 * 1000;
    case "last_month":   return nowMs - 30 * 24 * 60 * 60 * 1000;
    case "last_quarter": return nowMs - 90 * 24 * 60 * 60 * 1000;
    case "all":          return null;
    default:             return null;
  }
}

function sliceConditionalHistory(rows, opts) {
  const since = rangeSinceMs(opts.range, opts.nowMs);
  const filtered = since === null
    ? rows.slice()
    : rows.filter((r) => r.updated_at_ms >= since);
  filtered.sort((a, b) => b.updated_at_ms - a.updated_at_ms);
  const page = Math.max(1, opts.page);
  const pageSize = Math.max(1, opts.pageSize);
  const start = (page - 1) * pageSize;
  const end = Math.min(filtered.length, start + pageSize);
  const page_items = start >= filtered.length ? [] : filtered.slice(start, end);
  return { total: filtered.length, page_items };
}

function shortId(id) {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

const NOW = 1782_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function row(id, updatedAtMs, status = "armed", extras = {}) {
  return {
    id,
    account: "0xacc",
    option_series_id: "0xseries",
    position_side: "long",
    option_kind: "call",
    conditional_type: "tp",
    trigger_source: "mark",
    trigger_condition: "ge",
    trigger_price_1e8: "1000",
    quantity_1e8: "100",
    execution_type: "limit",
    limit_price_1e8: "1100",
    reduce_only: true,
    oco_group_id: null,
    status,
    child_order_id: null,
    failure_code: null,
    failure_message: null,
    expires_at_ms: null,
    triggered_at_ms: null,
    completed_at_ms: null,
    created_at_ms: updatedAtMs,
    updated_at_ms: updatedAtMs,
    version: 1,
    ...extras,
  };
}

test("isTerminalConditionalStatus marks each terminal state and rejects armed", () => {
  for (const s of ["triggered", "completed", "cancelled", "failed", "expired"]) {
    assert.equal(isTerminalConditionalStatus(s), true, `expected ${s} terminal`);
  }
  assert.equal(isTerminalConditionalStatus("armed"), false);
  assert.equal(isTerminalConditionalStatus("pending"), false);
  assert.equal(isTerminalConditionalStatus(""), false);
});

test("rangeSinceMs returns null for `all` (no lower bound)", () => {
  assert.equal(rangeSinceMs("all", NOW), null);
});

test("rangeSinceMs subtracts the right window per range", () => {
  assert.equal(rangeSinceMs("last_day", NOW), NOW - 1 * DAY);
  assert.equal(rangeSinceMs("last_week", NOW), NOW - 7 * DAY);
  assert.equal(rangeSinceMs("last_month", NOW), NOW - 30 * DAY);
  assert.equal(rangeSinceMs("last_quarter", NOW), NOW - 90 * DAY);
});

test("sliceConditionalHistory drops rows older than the range cutoff", () => {
  const rows = [
    row("recent", NOW - 1 * DAY),
    row("older",  NOW - 10 * DAY),
    row("ancient", NOW - 60 * DAY),
  ];
  const res = sliceConditionalHistory(rows, { range: "last_week", nowMs: NOW, page: 1, pageSize: 100 });
  assert.equal(res.total, 1);
  assert.equal(res.page_items[0].id, "recent");
});

test("sliceConditionalHistory `all` range keeps every row", () => {
  const rows = [row("a", 100), row("b", 200), row("c", 300)];
  const res = sliceConditionalHistory(rows, { range: "all", nowMs: NOW, page: 1, pageSize: 100 });
  assert.equal(res.total, 3);
});

test("sliceConditionalHistory sorts by updated_at_ms desc", () => {
  const rows = [
    row("a", NOW - 5 * DAY),
    row("b", NOW - 1 * DAY),
    row("c", NOW - 3 * DAY),
  ];
  const res = sliceConditionalHistory(rows, { range: "last_week", nowMs: NOW, page: 1, pageSize: 100 });
  assert.deepEqual(res.page_items.map((r) => r.id), ["b", "c", "a"]);
});

test("sliceConditionalHistory pagination math is correct (page 2, size 2)", () => {
  const rows = [
    row("a", NOW - 1 * DAY),
    row("b", NOW - 2 * DAY),
    row("c", NOW - 3 * DAY),
    row("d", NOW - 4 * DAY),
    row("e", NOW - 5 * DAY),
  ];
  const res = sliceConditionalHistory(rows, { range: "last_week", nowMs: NOW, page: 2, pageSize: 2 });
  assert.equal(res.total, 5);
  assert.deepEqual(res.page_items.map((r) => r.id), ["c", "d"]);
});

test("sliceConditionalHistory page past the end returns empty page (total preserved)", () => {
  const rows = [row("a", NOW - 1 * DAY)];
  const res = sliceConditionalHistory(rows, { range: "last_week", nowMs: NOW, page: 50, pageSize: 100 });
  assert.equal(res.total, 1);
  assert.deepEqual(res.page_items, []);
});

test("sliceConditionalHistory does NOT mutate input array", () => {
  const rows = [row("a", 100), row("b", 200)];
  const snapshot = rows.map((r) => r.id);
  sliceConditionalHistory(rows, { range: "all", nowMs: NOW, page: 1, pageSize: 10 });
  assert.deepEqual(rows.map((r) => r.id), snapshot);
});

test("shortId leaves short ids alone and truncates UUIDs / hex hashes", () => {
  assert.equal(shortId(null), "—");
  assert.equal(shortId(undefined), "—");
  assert.equal(shortId(""), "—");
  assert.equal(shortId("abc"), "abc");
  assert.equal(shortId("abcdefghij"), "abcdefghij");
  assert.equal(shortId("abcdef12345678"), "abcdef…5678");
  const uuid = "11111111-2222-3333-4444-555555555555";
  assert.equal(shortId(uuid), "111111…5555");
});
