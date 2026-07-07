// SUBACCOUNTS-FRONTEND-SWITCHER-V1 — active-subaccount storage contract.
//
// Re-implements the persistence rules used by
// `src/lib/subaccount-storage.ts` and asserts:
//   - the localStorage key is `deopt.subaccount.<address-lowercased>`;
//   - malformed / missing values return null (never throw);
//   - values below 1 or non-finite are rejected;
//   - the URL `?subaccount=<N>` parser accepts N ≥ 1 and rejects the rest.
//
// The app module is TypeScript with `use client` / `window`
// side-effects, so we assert against a fresh JS port so Node's test
// runner doesn't need a bundler.

import { test } from "node:test";
import assert from "node:assert/strict";

const KEY_PREFIX = "deopt.subaccount.";

function keyFor(address) {
  return `${KEY_PREFIX}${address.toLowerCase()}`;
}

function readActiveSubaccountId(storage, address) {
  const raw = storage.getItem(keyFor(address));
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    const id = parsed.subaccountId;
    if (typeof id === "number" && Number.isFinite(id) && id >= 1) {
      return Math.floor(id);
    }
  } catch {
    /* fall through */
  }
  return null;
}

function writeActiveSubaccountId(storage, address, subaccountId) {
  storage.setItem(
    keyFor(address),
    JSON.stringify({ subaccountId, lastUpdatedMs: 1_700_000_000_000 }),
  );
}

function readSubaccountFromUrl(search) {
  const params = new URLSearchParams(search);
  const raw = params.get("subaccount");
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return null;
}

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
}

test("storage key is lowercased under `deopt.subaccount.` prefix", () => {
  assert.equal(
    keyFor("0xAABBCCDDEEFF00112233445566778899AABBCCDD"),
    "deopt.subaccount.0xaabbccddeeff00112233445566778899aabbccdd",
  );
});

test("readActiveSubaccountId returns null when missing", () => {
  const s = new MemoryStorage();
  assert.equal(readActiveSubaccountId(s, "0xabc"), null);
});

test("readActiveSubaccountId returns the persisted value", () => {
  const s = new MemoryStorage();
  writeActiveSubaccountId(s, "0xABC", 3);
  assert.equal(readActiveSubaccountId(s, "0xabc"), 3);
  assert.equal(readActiveSubaccountId(s, "0xABC"), 3);
});

test("readActiveSubaccountId rejects malformed JSON", () => {
  const s = new MemoryStorage();
  s.setItem(keyFor("0xabc"), "not-json");
  assert.equal(readActiveSubaccountId(s, "0xabc"), null);
});

test("readActiveSubaccountId rejects ids below 1", () => {
  const s = new MemoryStorage();
  s.setItem(keyFor("0xabc"), JSON.stringify({ subaccountId: 0 }));
  assert.equal(readActiveSubaccountId(s, "0xabc"), null);
  s.setItem(keyFor("0xabc"), JSON.stringify({ subaccountId: -1 }));
  assert.equal(readActiveSubaccountId(s, "0xabc"), null);
});

test("readActiveSubaccountId rejects non-numeric ids", () => {
  const s = new MemoryStorage();
  s.setItem(keyFor("0xabc"), JSON.stringify({ subaccountId: "3" }));
  assert.equal(readActiveSubaccountId(s, "0xabc"), null);
});

test("readSubaccountFromUrl parses ?subaccount=<N>", () => {
  assert.equal(readSubaccountFromUrl("?subaccount=2"), 2);
  assert.equal(readSubaccountFromUrl("?foo=bar&subaccount=7"), 7);
});

test("readSubaccountFromUrl rejects invalid values", () => {
  assert.equal(readSubaccountFromUrl(""), null);
  assert.equal(readSubaccountFromUrl("?subaccount=0"), null);
  assert.equal(readSubaccountFromUrl("?subaccount=-1"), null);
  assert.equal(readSubaccountFromUrl("?subaccount=abc"), null);
  assert.equal(readSubaccountFromUrl("?subaccount="), null);
});
