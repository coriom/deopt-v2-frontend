# HISTORY-V2-TERMINAL-REASONS-V1 — frontend result

**Status: CLOSED.**

Consumes the new persisted terminal-reason fields on `option_orders`
(see backend doc:
`deopt-v2-backend/docs/HISTORY_V2_TERMINAL_REASONS_V1_RESULT.md`) so
the `/history` Orders tab can distinguish a real user cancel from a
TIF-inferred IOC remainder cancel. TIF inference is kept as a
fallback for legacy rows that pre-date migration 0030.

---

## Wire-level contract

`HistoryV2Item` now carries three optional reason fields populated
only on the Orders tab and only for terminal rows whose cause the
backend knows:

```ts
interface HistoryV2Item {
  // ... existing fields ...
  terminal_reason_code?: string;     // e.g. "user_cancelled"
  terminal_reason_message?: string;  // optional free-text detail
  terminal_reason_source?: string;   // e.g. "user", "tif_policy", "system"
}
```

Codes the backend stamps today:

| code | source | severity |
|---|---|---|
| `user_cancelled` | `user` | info |
| `ioc_remainder_cancelled` | `tif_policy` | info |

Unknown codes render as the raw token with `warning` severity (no
fabrication).

---

## `deriveOrderReason` priority

Updated in `src/lib/history-reasons.ts`:

1. **Persisted backend reason wins.** If
   `item.terminal_reason_code` is present (non-empty), the helper
   returns `{ code, message: terminal_reason_message ?? tableLabel,
   severity: tableSeverity, source: terminal_reason_source }`.
   `terminal_reason_message` is `clampMessage`-bounded so a
   malicious / mis-configured row can't render arbitrarily long
   blobs into the tooltip.
2. **TIF-derived inference is the fallback.** For rows with no
   persisted code (e.g. pre-migration legacy rows), the helper falls
   back to the prior `(status, order_type, post_only, amount,
   filled)` inference rules unchanged.

Hard invariants:

* successful (`filled`) and active (`open` / `partially_filled`) rows
  return `null` regardless of whether a stray `terminal_reason_code`
  is present — success never carries a failure reason;
* the conditional-order path
  (`deriveConditionalReason({ failure_code, failure_message })`) is
  unchanged — TP/SL rows continue to read directly from the worker's
  `failure_code` / `failure_message` columns.

The `HistoryReason` model gained an optional `source?: string` field
so the persisted-vs-inferred distinction can be pinned by tests and
inspected in dev tools. When present it is rendered as
`data-reason-source` on the Reason cell.

---

## UI

`src/components/history/HistoryShell.tsx` — `renderReasonCell` now
spreads `data-reason-source` onto the rendered `<span>` when
`reason.source` is set:

```html
<span
  data-reason-code="user_cancelled"
  data-reason-severity="info"
  data-reason-source="user"
  title="Cancelled by user"
  class="text-zinc-400">
  user_cancelled
</span>
```

The visual rendering, severity → colour mapping, CSV export, and
Reason column placement are otherwise unchanged from
`HISTORY-V2-FAILURE-REASONS-V1`.

Trades/Fills tab remains intentionally without a Reason column
(fills are always successful executions).

---

## Refresh / resync

Unchanged. The lifecycle WS still emits the existing `OrderUpdated`
payload (no new fields); a click on the refresh banner re-fetches
the orders tab and a row whose persisted reason now exists will flip
its visible code. New Playwright test covers the inferred →
persisted transition.

---

## Tests

### Node (`tests/node/history-reasons.contract.mjs`, +9 cases → 64/64)

* persisted `user_cancelled` wins on a `cancelled` row;
* persisted reason wins over TIF inference (same row would otherwise
  infer differently);
* persisted `ioc_remainder_cancelled` is tagged with source
  `tif_policy`;
* persisted unknown code renders raw token + warning severity;
* persisted row prefers `terminal_reason_message` over the table
  fallback when present;
* persisted reason on a SUCCESSFUL row is still suppressed (success
  has no failure);
* no persisted reason → TIF inference still applies (legacy rows);
* persisted reason without source omits the source field;
* long `terminal_reason_message` is clamped to ≤ 240 chars.

### Playwright (`tests/e2e/history-reasons-terminal-v1.spec.ts`, 5 tests)

* Orders tab renders persisted `user_cancelled` (not the bare
  `cancelled` fallback);
* persisted reason wins over TIF inference;
* persisted `ioc_remainder_cancelled` tagged with source
  `tif_policy`;
* unknown persisted code renders raw token + warning severity (no
  fabrication);
* refresh banner + REST resync flips an inferred reason to its
  persisted equivalent (including `data-reason-source` arrival).

Prior `tests/e2e/history-reasons-v1.spec.ts` (6 tests) remains
green and unchanged — its rows still don't carry persisted reasons,
so the TIF-inference fallback continues to cover them.

---

## Files changed (frontend)

### New

* `tests/e2e/history-reasons-terminal-v1.spec.ts`
* `docs/HISTORY_V2_TERMINAL_REASONS_V1_RESULT.md`

### Modified

* `src/lib/trading-api.ts` — extended `HistoryV2Item` with
  `terminal_reason_code` / `terminal_reason_message` /
  `terminal_reason_source`.
* `src/lib/history-reasons.ts` — `HistoryReason.source?` added;
  `deriveOrderReason` prefers persisted backend reason over TIF
  inference; legacy inference unchanged.
* `src/components/history/HistoryShell.tsx` — `renderReasonCell`
  surfaces `data-reason-source` on the rendered cell when present.
* `tests/node/history-reasons.contract.mjs` — mirrored the priority
  logic + +9 cases.

---

## Validations (frontend)

| | result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run build` | clean (rebuilt with `NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:4010`) |
| `npm run test:node` | **64/64** (was 55; +9 reason-priority tests) |
| `npx playwright test` | **305 passed / 1 skipped / 0 failed** |
| `git diff --check` | clean |

The single skip is the documented landing-particle scroll test from
`PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1` (unrelated to this
milestone).

---

## Safety

* No mainnet. No deployment. No Solidity. No transaction. No broadcast.
* No matching/TP-SL/write-auth semantics change.
* No real keys; no secret in logs / traces / artifacts.
* No perps lifecycle masquerading as live.
* No fabricated reasons — persisted codes come from the backend
  enum; the unknown-code fallback renders the raw token without
  inventing a label.
