# Admin V2 Fee Observability V2E-H

Date: 2026-05-29

## Scope

Make the admin UI clearly render the V2 fee accounting surfaced by the
backend after V2E-G validated FeesManagerV2 on options. Read-only only —
no broadcast, no submit, no transaction creation. Frontend code only.

## Endpoints Consumed (read-only)

Both calls use the existing admin pattern: base URL from
`NEXT_PUBLIC_BACKEND_URL`, `X-Admin-Token` from in-memory React state
backed by `sessionStorage`, `method: "GET"`, `cache: "no-store"`.

- `GET /admin/options/executions/:intent_id/lifecycle` — existing
  endpoint. The Fees section now renders the V2 fields the backend
  already exposes on `LifecycleFees`.
- `GET /admin/fees/onchain[?tx_hash=<hex>]` — newly consumed by the
  admin dashboard. Read-only; query may be empty to fetch the overall
  rollup, or include a `tx_hash` to scope to a single transaction.

## Files Changed

- `src/types/admin.ts`
  - Added `AdminFeesOnchainSuccess`, `AdminFeesOnchainFailure`, and
    `AdminFeesOnchainResult` for typing the new endpoint result.
- `src/lib/admin-api.ts`
  - Added `fetchAdminFeesOnchain(token, txHash, signal)`. Same `GET`,
    `cache: "no-store"`, header-auth contract as the other admin calls.
- `src/app/admin/admin-dashboard.tsx`
  - Rewrote `LifecycleFeesSection` to surface the V2 fields.
  - Added `LifecycleFeesEventModelBanner` to interpret `event_model`,
    `source_priority`, and a zero `fee_rebated_v2_count`.
  - Added `LifecycleV2FeeEventCards` rendering per-event V2 details.
  - Added `AdminFeesOnchainSection` card with optional `tx_hash` input,
    `Fill V2E-G Tx` quick-fill, and a `Load on-chain fees` button.
  - Added `AdminFeesOnchainView` for rendering the response.
  - Added `Fill V2E-G Intent` quick-fill button next to the existing
    `Fill V1S Intent` button on the lifecycle card.
  - Added `MetricCard` `warn` variant for the `mixed` event model.
  - Added `toFiniteNumber` helper for safely parsing string/number
    counts coming back as JSON.
- `docs/ADMIN_V2_FEE_OBSERVABILITY_V2E_H.md` (this file).

No backend Rust, no Solidity, no wallet writes, no new permission paths.

## UI Fields Added

### Lifecycle Fees section (V2 additions)

Top metric grid:

- `event_model`
- `source_priority`
- `trading_fee_event_count`
- `fee_charged_v2_count`
- `fee_rebated_v2_count`
- `observed_total_charged`
- `observed_total_rebated`
- `net_protocol_fee`
- `backend_ledger_status`
- `reconciliation_status`

Aggregations:

- `by_side` — per-side charged totals (`maker` / `taker` / `unknown`).
- `by_trader` — per-trader charged totals (lowercased addresses).
- `by_recipient` — per-recipient totals (kept as the primary recipient
  map; `total_by_recipient` is the V1Z back-compat alias and is used as
  a fallback when `by_recipient` is absent).
- `rebated_by_trader` — only shown when at least one rebate is present.

Per-event V2 cards (one card per `FeeChargedV2` event, plus a parallel
list for `FeeRebatedV2` when any are present), each card lists:

- `trader`
- `recipient`
- `productKind` (rendered from `product_kind` or `productKind`)
- `flowKind` (rendered from `flow_kind` or `flowKind`)
- `isMaker` (rendered from `is_maker` or `isMaker`)
- `side` (`maker` / `taker`)
- `feePpm` (or `rebatePpm` for rebated cards)
- `basisAmount` — rendered defensively from `basis_amount` /
  `basisAmount`. The current backend `LifecycleFees::events`
  serialization does not yet surface `basisAmount`, so this cell shows
  `n/a` until backend `collect_event_payloads` is extended. Kept as a
  field so the UI is forward-compatible.
- `feeAmount` (or `rebateAmount` for rebated cards, falling back to
  `applied_fee`)
- `tx_hash`, `log_index`, `block_number`, `source_contract`

Banner (interprets the event model):

- `event_model = mixed` → "V2 is the source of truth; V1 compatibility
  events (TradingFeeCharged) are present but not used for totals."
- `event_model = v2` → "totals come from FeeChargedV2 / FeeRebatedV2
  only."
- `event_model = v1` → "totals come from the legacy TradingFeeCharged
  event stream only."
- `event_model = none` → "no fee events were indexed for this trade."
- `source_priority = v2` → "totals use V2 FeeChargedV2 / FeeRebatedV2."
- `fee_rebated_v2_count = 0` → "No FeeRebatedV2 emitted (Tier0 has no
  negative maker ppm)."

The "All Fee Events" `JsonTable` block from the previous view is kept
below the V2 cards as a raw record fallback.

### New On-chain Fee Events card

Targets `GET /admin/fees/onchain[?tx_hash=…]`. Inputs and surfaced
fields:

- Optional `tx_hash` input plus a `Fill V2E-G Tx` quick-fill button.
- Filter chips showing the `filter.tx_hash` and `filter.limit` actually
  applied by the backend.
- Metric grid: `event_model`, `source_priority`, `fee_charged_v2_count`,
  `fee_rebated_v2_count`, `trading_fee_event_count`,
  `observed_total_charged`, `observed_total_rebated`, `net_protocol_fee`,
  `backend_ledger_status`, `reconciliation_status`.
- Aggregations: `by_side`, `by_trader` (charged), `by_recipient`,
  `rebated_by_trader` (when non-empty).
- Per-tx breakdown rendered as a `JsonTable` over the response
  `transactions` array (one row per `tx_hash`, with its own per-tx
  counts and totals).
- Per-event `JsonTable` over the response `events` array (both V1
  compatibility events and V2 events are listed; `event_model` per row
  identifies which is which).

## V2E-G Manual Verification Result

Reference data, taken from `docs/FEES_MANAGER_V2_TINY_TRADE_BROADCAST_RESULT_V2E_G.md`
(backend repo):

```text
intent_id = 94897ee5-e855-40b6-a917-1476578fe48b
tx_hash   = 0xd51ea881cdbc32fe724034c0f7e25ade7359ea3d5b6cadb17b7c345effefc72c
event_model = mixed
source_priority = v2
trading_fee_event_count = 2     (V1 compat)
fee_charged_v2_count    = 2     (V2 — taker + maker)
fee_rebated_v2_count    = 0     (Tier0, no rebate)
observed_total_charged = 16
observed_total_rebated = 0
net_protocol_fee       = 16
by_side    = { taker: "13", maker: "3" }
by_trader  = { buyer: "13", seller: "3" }      (lowercased addresses)
by_recipient = { 0xa67f…b588: "16" }
taker fee = ceil(50_000 × 250 / 1e6) = 13
maker fee = ceil(50_000 × 50 / 1e6)  = 3
```

Frontend rendering result (against a backend serving the V2E-G payload):

- `Fill V2E-G Intent` populates intent `94897ee5-…`. Loading the
  lifecycle renders the V2 banner ("event_model = mixed: V2 is the
  source of truth…"), the source-priority banner ("source_priority =
  v2: totals use V2 FeeChargedV2 / FeeRebatedV2."), and the "No
  FeeRebatedV2 emitted" banner.
- Top metric grid shows `event_model=mixed`, `source_priority=v2`,
  `trading_fee_event_count=2`, `fee_charged_v2_count=2`,
  `fee_rebated_v2_count=0`, `observed_total_charged=16`,
  `observed_total_rebated=0`, `net_protocol_fee=16`.
- `By Side` table shows `taker=13`, `maker=3`. `By Trader` shows the
  buyer at `13` and the seller at `3`. `By Recipient` shows
  `0xa67f…b588 → 16`.
- Two `FeeChargedV2` event cards are rendered with the per-event
  fields. `productKind=option`, `flowKind=orderbook`, `isMaker` flips
  between cards, `feePpm` is `250` (taker) and `50` (maker), `feeAmount`
  is `13` and `3`. `basisAmount` shows `n/a` (backend does not yet
  surface it on the lifecycle events array — see above).
- The `On-chain Fee Events` card's `Fill V2E-G Tx` populates
  `0xd51ea881…fc72c`. Loading the endpoint reproduces the same totals
  in the metric grid and yields one row in `Per-Tx Breakdown` plus four
  rows in `Fee Events` (2 V1 compat + 2 V2).

## No-write Proof

Verification commands run from `~/DEOPT/deopt-v2-frontend`:

```text
rg -n "POST|broadcast|eth_sendRawTransaction|/executor|/options/execution-intents/.*/broadcast" src
rg -n "method:\s*\"(POST|PUT|PATCH|DELETE)\"|fetch.*POST|sendRawTransaction|/executor/broadcast|/execution-intents/.*broadcast|/broadcast" src
```

- The first hit list shows only read-only contexts: the existing
  `LifecycleBroadcastSection` fields, the `real_broadcast_enabled`
  status flag, and danger-flag chips that display the boolean. No
  fetcher targets a `/broadcast` or `/executor` route.
- The second command (filters on actual write call shapes) returns no
  hits — there is no `method: "POST"` (or PUT/PATCH/DELETE), no
  `sendRawTransaction`, no broadcast route fetch in `src`.

`fetchAdminFeesOnchain` and `fetchOptionExecutionLifecycle` both route
through the shared `fetchAdminPath`, which hard-codes `method: "GET"`
and `cache: "no-store"`. No write surface was introduced.

## Validation Commands Run

```text
npm run lint
npx tsc --noEmit
npm run build
```

Results:

| Command            | Result                                            |
| ------------------ | ------------------------------------------------- |
| `npm run lint`     | clean (no ESLint output)                          |
| `npx tsc --noEmit` | clean (no diagnostics)                            |
| `npm run build`    | `✓ Compiled successfully`, `/admin` static route, `5/5` static pages generated |

UI smoke verification beyond build was not run in this loop — the
backend would need to be running with the V2E-G fixtures restored. The
view contracts above are derived from
`deopt-v2-backend/src/options/lifecycle.rs` (`LifecycleFees`) and
`deopt-v2-backend/src/fees/onchain_summary.rs`
(`AdminOnchainSummary::into_admin_json` / `collect_event_payloads`).

## Remaining Blocker Before Perps

1. `basisAmount` is not yet surfaced through
   `collect_event_payloads` in `deopt-v2-backend/src/fees/onchain_summary.rs`,
   so the per-event card shows `n/a` for it. The Solidity
   `FeeChargedV2`/`FeeRebatedV2` payloads carry it, the
   `NormalizedFeeEvent` struct could add it. This is a one-field
   backend change and is the only field listed in the V2E-H task that
   the lifecycle/onchain JSON does not already expose. Marked out of
   scope for this read-only frontend pass.
2. Tier1+ live rebate path (`FeeRebatedV2`) is still unexercised
   on-chain (carried over from V2E-G blockers). Until a rebate is
   broadcast, the "Rebated By Trader" map and `FeeRebatedV2 Events`
   list will always be empty in production telemetry.
3. Perp product V2 fee adoption (`PerpEngine.setFeesManagerV2 +
   setUseFeesManagerV2(true)`) is the next launch milestone. The
   indexer and the frontend handle V2 events independent of the
   emitting product (`productKind` is rendered per event), so this
   surface is ready to render perp V2 fees as soon as they land.

No frontend blocker remains for surfacing V2 option fees.
