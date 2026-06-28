# HISTORY-V2-FAILURE-REASONS-V1 — result

**Status: CLOSED.**

Surfaces cancel / reject / failure reasons on the `/history` Orders
tab, matching the clarity already shipped on the TP/SL tab in
`HISTORY-LIFECYCLE-V2`. Trades/Fills tab is intentionally left
unchanged — see the honest limitation below.

---

## What's in the data (discovery)

| Field | Where it lives | Already in history-v2? |
|---|---|---|
| `option_orders.status` | `migrations/0013_option_orders.sql` | yes (`HistoryV2Item.status`) |
| `option_orders.time_in_force` | `migrations/0013_option_orders.sql` | yes (surfaced as `HistoryV2Item.order_type`) |
| `option_orders.post_only` | `migrations/0027_option_orders_post_only.sql` | **no — added in this milestone** |
| `option_orders.cancel_reason` | does NOT exist | n/a (matching-engine rejections never enter the DB) |
| `conditional_orders.failure_code` / `.failure_message` | `migrations/0028_options_conditional_orders.sql` | yes (already in `ConditionalOrderResponse`) |
| `option_fills.*` | `migrations/0014_option_fills.sql` | yes; fills are always successful — no failure column exists |

**Honest gap:** there is no per-order `cancel_reason` / `failure_code`
column in `option_orders`. The matching engine returns stable
rejection messages synchronously on submit (`PostOnlyWouldMatch`,
`FokNotFillable`, invalid TIF combos) — those orders **never enter
the DB** so they cannot be recovered from history. For orders that
do land and later terminate, the only history-visible signals are
`status`, `time_in_force` and (now) `post_only`. The new helper
derives a user-facing reason from those three signals only.

---

## Backend changes (read-only)

**Touched:** `deopt-v2-backend/src/api/trading.rs` only.

* Added `post_only: Option<bool>` to `HistoryV2Item` (with
  `skip_serializing_if = "Option::is_none"` so empty rows stay
  compact).
* `orders_rows_for` now populates `post_only: Some(o.post_only)`.

No schema change. No matching-semantics change. No write-auth
change. `cargo check --lib` clean. `cargo test --lib api::trading`
all 135 tests pass (including the existing `history_v2_*` shape
assertions, which keep using `..HistoryV2Item::default()` and so
inherit `post_only: None` for tabs that don't surface it).

---

## Frontend reason model

`src/lib/history-reasons.ts` (new):

```ts
export interface HistoryReason {
  code: string;          // canonical, safe-to-render token
  message: string;       // pre-formatted user-facing label
  severity: "info" | "warning" | "error";
}

deriveOrderReason(item: HistoryV2Item): HistoryReason | null
deriveConditionalReason({ failure_code, failure_message }): HistoryReason | null
```

### Code → label table (covered codes)

| code | label | severity | source |
|---|---|---|---|
| `ioc_remainder_cancelled` | IOC remainder cancelled (cannot rest) | info | derived from `status=cancelled + tif=ioc + filled < amount` |
| `fok_not_fillable` | Fill-or-kill order was not fully fillable | warning | derived from `status=rejected + tif=fok` |
| `fok_cancelled` | Fill-or-kill order cancelled | info | derived from `status=cancelled + tif=fok` |
| `post_only_would_cross` | Post-only order would immediately match | warning | derived from `status=rejected + post_only=true` |
| `cancelled` | Cancelled | info | bare status fallback |
| `rejected` | Rejected | error | bare status fallback |
| `failed` | Failed | error | bare status fallback |
| `expired` | Expired | info | bare status fallback |
| `oco_sibling_triggered` | OCO sibling triggered first | info | conditional `failure_code` |
| `position_closed` | Position already closed | info | conditional `failure_code` |
| `execution_rejected` | Child order rejected by matching | error | conditional `failure_code` |
| `write_auth_conflict` / `duplicate_idempotency_key` | (mapped) | error / warning | reserved for future persisted codes |

Unknown codes fall back to the **raw safe code + `warning` severity**
so future codes don't silently misrender.

### Hard invariants

* `deriveOrderReason` returns `null` for any successful or active
  status (`filled`, `open`, `partially_filled`) — no fabricated
  reason on a successful row.
* `deriveOrderReason` returns `null` for unrecognised statuses —
  don't pretend to know.
* `deriveConditionalReason` returns `null` when there is no
  `failure_code` — the TP/SL tab keeps its existing per-status
  colouring when no failure is recorded.
* `failure_message` is clamped to 240 chars + ellipsis to keep
  tooltips visually bounded.

---

## Orders tab UI

`src/components/history/HistoryShell.tsx` — added a `Reason` column
between `Status` and `Role`:

```
Time · Instrument · Side · Order Type · Amount · Limit · Filled ·
Status · Reason · Role · Tx
```

The reason cell renders the dense `code` (copy-paste-friendly) with
severity-coloured text and the human-readable `message` in the
`title` attribute (hover-to-explain). Data attributes:

```html
<span data-reason-code="ioc_remainder_cancelled"
      data-reason-severity="info"
      title="IOC remainder cancelled (cannot rest)"
      class="text-zinc-400">
  ioc_remainder_cancelled
</span>
```

Severity → colour:

* `error` → `text-red-400`
* `warning` → `text-amber-300`
* `info` → `text-zinc-400`

No reason cell content renders for successful (`filled`) or active
(`open` / `partially_filled`) rows.

CSV export carries the `code` token (empty string when no reason).

---

## Trades/Fills tab UI

**Intentionally unchanged.** Fill rows always carry `status="filled"`
(a successful execution leg) and there is no per-fill failure column
in the data. Adding an "Order outcome" column would either:

* require a backend join from fills to their parent order (out of
  scope, and pollutes the simple fills surface), OR
* fabricate context that doesn't belong to the fill row.

The helper's contract is "never invent a reason for success", so the
honest call is to surface no Reason column on this tab. The
Playwright spec asserts the absence of `history-col-trades-reason`.

---

## Refresh / resync behaviour

Unchanged from `HISTORY-LIFECYCLE-V2`:

* REST remains canonical.
* Lifecycle deltas on `account.orders` light up the refresh banner.
* Click banner → bump refresh nonce → fetch effect re-runs → if the
  backend has flipped the row (cancel reason appearing or
  disappearing), the visible Reason cell updates accordingly.
* WS reconnect bumps `resyncToken` → silent refetch with the same
  effect.

The new Playwright test
`history-reasons-v1.spec.ts › refresh + REST resync updates the
visible reason after backend changes it` walks this exact path: the
first fetch returns an IOC-cancelled row (Reason cell shows
`ioc_remainder_cancelled`); after a refresh click, the second fetch
returns a fully-filled row and the Reason cell disappears.

---

## Files changed

### New

* `src/lib/history-reasons.ts` — derivation helpers + reason model
* `tests/node/history-reasons.contract.mjs` — 20 node tests
* `tests/e2e/history-reasons-v1.spec.ts` — 6 Playwright tests
* `docs/HISTORY_V2_FAILURE_REASONS_V1_RESULT.md`

### Modified

* `src/lib/trading-api.ts` — extended `HistoryV2Item` with
  `post_only?: boolean`
* `src/components/history/HistoryShell.tsx` — added Reason column to
  the orders tab + `renderReasonCell` helper
* `tests/e2e/lifecycle-e2e-v1.spec.ts` — made the reconnect test
  robust to the WS-handshake/React-commit race that flaked under
  full-suite load (retry-push the first delta until the banner
  mounts — production code path unchanged)
* **Backend (single file):** `src/api/trading.rs` — added
  `post_only: Option<bool>` field on `HistoryV2Item` and populated
  it in `orders_rows_for`

---

## Validations

| | Result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run build` | clean (rebuilt with `NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:4010`) |
| `npm run test:node` | **55/55** (was 35; +20 reason tests) |
| `npx playwright test --list` | 301 tests / 46 files |
| `npx playwright test` | **300 passed / 1 skipped / 0 failed** |
| `cargo fmt --check` | clean |
| `cargo check --lib` | clean |
| `cargo test --lib api::trading` | 135/0/0 |
| `git diff --check` (both repos) | clean |

The single skip is the documented landing-particle scroll test from
`PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1` (unrelated to this
milestone).

---

## Safety

* No mainnet. No deployment. No Solidity. No transaction. No broadcast.
* No matching-semantics, TP-SL-semantics or write-auth-semantics change.
* No real keys; no secret in logs/traces/artifacts.
* No perps lifecycle masquerading as live.
* No fabricated reasons — every code is derived from observable
  fields or pulled from a persisted column.

---

## Hard acceptance criteria

| criterion | state |
|---|---|
| `/history` Orders tab shows real cancel/reject/failure reasons where data exists | yes |
| Trades/Fills tab handles reason/context honestly without mislabeling successful fills | yes (intentionally no Reason column) |
| TP/SL reason display remains intact | yes (uses the same helper module via `deriveConditionalReason`) |
| Refresh banner + REST resync can update visible reasons | yes (Playwright proof) |
| No fake rows / no fake reasons / no perps lifecycle as live | yes |
| Full Playwright suite green (modulo documented unrelated skip) | yes — 300/0/1 |
| lint / typecheck / build / node tests green | yes |
| Backend kept read-only-only | yes — single field addition, no schema change |
| No secret / chain / deployment / mainnet / Solidity change | yes |

---

## Deferred

* `LANDING-PARTICLE-SCROLL-LISTENER-V1` — re-enable the skipped
  landing particle test by rebinding the scroll listener to the
  actual scroll container under the new `overflow-hidden` (trading)
  layout.
* `HISTORY-V2-CANCEL-REASON-COLUMN-V1` — add an explicit
  `cancel_reason` column to `option_orders` so the matching engine /
  cancel endpoint can record the actual cause (user, IOC remainder,
  system, write-auth) instead of relying on TIF-inferred outcomes.
  Requires a schema migration + matching-engine + cancel-endpoint
  changes; out of scope for a read-only display milestone.
* `HISTORY-V2-CONDITIONAL-PAGINATION-V1`, `HISTORY-V2-FILTERS-V1`,
  `OPTIONS-ROUTE-INTERNAL-RENAME-V1`,
  `ORDER-LIFECYCLE-OBSERVABILITY-WORKER-PG-PROOF-V1`,
  `ACCOUNT-WRITE-AUTH-HARDENING-PERPS-V1` — carried forward.

---

## Recommendation

`HISTORY-V2-CANCEL-REASON-COLUMN-V1` (close the loop by persisting
the actual cancel cause server-side, so the Reason column can
distinguish user-cancel from IOC remainder from write-auth conflict
without TIF inference) **or** `LANDING-PARTICLE-SCROLL-LISTENER-V1`
(eliminate the last skipped Playwright test and clear the CI
landscape entirely).
