# Admin Option Lifecycle View V2A

Date: 2026-05-24

## Endpoint Consumed

The admin dashboard consumes:

```text
GET /admin/options/executions/:intent_id/lifecycle
```

The frontend uses the existing admin API behavior:

- base URL from `NEXT_PUBLIC_BACKEND_URL`, falling back to the existing local default
- `X-Admin-Token` from the existing in-memory React state backed by `sessionStorage`
- `GET` only, `cache: no-store`

## UI Sections

The `/admin` page now includes an `Option Execution Lifecycle` card with:

- intent id input
- `Load lifecycle` button
- `Fill V1S Intent` quick-fill for `e6d2941b-65f7-413a-958f-74ab22c53b08`
- loading, empty, backend-offline, HTTP error, and malformed-response states via the existing admin error handling

Lifecycle data is rendered in these read-only sections:

- health
- intent / trade
- option metadata
- signatures
- simulation
- calldata
- broadcast / gas safety
- confirmation
- events
- fees
- transfers
- reconciliation

Long hashes, UUIDs, and addresses are visually shortened where useful, expose the full value in the browser title, and include a local clipboard copy button. Missing optional fields render as `n/a`.

## Read-Only Safety Statement

This view adds no wallet flow and no write-capable backend action. It only calls the lifecycle `GET` endpoint. It does not call:

- `/executor/broadcast`
- `POST /options/execution-intents/:id/broadcast`
- any Solidity or wallet write path

The admin token handling is unchanged and remains limited to the existing `sessionStorage` behavior in the admin dashboard.

## V1S Manual Verification Intent

Known V1S option execution intent:

```text
e6d2941b-65f7-413a-958f-74ab22c53b08
```

Backend V1Z live verification for this intent returned:

- `health.stage = reconciled`
- `health.is_terminal_success = true`
- `events.total = 19`
- `reconciliation.status = reconciled`
- `warnings = []`
- `errors = []`

## Live Verification Result

Date: 2026-05-24

Backend health at `http://127.0.0.1:8080/health` returned HTTP 200:

```json
{"ok":true,"service":"deopt-v2-backend"}
```

Direct lifecycle API verification used the existing admin token header against:

```text
GET /admin/options/executions/e6d2941b-65f7-413a-958f-74ab22c53b08/lifecycle
```

The live response matched the expected terminal success state:

- `health.stage = reconciled`
- `health.is_terminal_success = true`
- `broadcast.tx_hash = 0x5964a7b3d2c18d051baaa780413d31c44d419ce530f45263cb4c46f720881125`
- `confirmation.confirmation_status = mined_success`
- `events.total = 19`
- `events.counts_by_event_name.TradingFeeCharged = 2`
- `events.counts_by_event_name.InternalTransfer = 3`
- `fees.trading_fee_event_count = 2`
- `fees.total_by_recipient` total = `10`
- `transfers.internal_transfer_count = 3`
- `reconciliation.status = reconciled`
- `health.warnings = []`
- `health.errors = []`

Frontend verification started the dev server with:

```text
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080 npm run dev
```

The `/admin` route returned HTTP 200. A temporary Node render harness transpiled the real `src/app/admin/admin-dashboard.tsx` module in memory and rendered the actual lifecycle view components with the live V1S JSON. The rendered output contained all expected lifecycle sections and values:

- Health
- Intent / trade
- Option metadata
- Signatures
- Simulation
- Calldata
- Broadcast / gas safety
- Confirmation
- Events
- Fees
- Transfers
- Reconciliation
- `stage: reconciled`
- `terminal success: true`
- tx hash `0x5964a7b3...20881125`, with the full hash present in the title text
- `mined_success`
- total event count `19`
- `TradingFeeCharged = 2`
- `InternalTransfer = 3`
- reconciliation status `reconciled`

Unknown intent verification used:

```text
00000000-0000-0000-0000-000000000000
```

The direct lifecycle endpoint returned HTTP 404 with `{"error":"invalid option execution intent id"}`. The frontend error component rendered a clean error state containing `http_error`, `HTTP 404`, and `invalid option execution intent id`.

Safety verification:

- `rg -n "POST|broadcast|executor|sendRawTransaction|eth_sendRawTransaction" src` found only read-only `broadcast` display fields and `real_broadcast_enabled` status display.
- A focused write-call search found no `POST`, `/executor/broadcast`, `/options/execution-intents/:id/broadcast`, `sendRawTransaction`, or `eth_sendRawTransaction` usage in `src`.
- The admin API helper still sends lifecycle requests with `method: "GET"` only.

Validation passed:

```text
npm run lint
npx tsc --noEmit
npm run build
```

Remaining blocker: none.

## Validation Commands

Required frontend validation:

```text
npm run lint
npx tsc --noEmit
npm run build
```

## Notes

The current backend lifecycle response includes `metadata.strike_1e8`; the UI labels this as `Strike`. The requested `is_european` field is handled defensively and displays `n/a` when absent.

## Follow-up: V2E-H

The Fees section of the lifecycle view has since been extended to
surface the V2 fee accounting (`event_model`, `source_priority`,
`fee_charged_v2_count` / `fee_rebated_v2_count`,
`observed_total_charged` / `observed_total_rebated`, `net_protocol_fee`,
`by_side` / `by_trader` / `by_recipient`, and per-event V2 cards). An
on-chain fees card consuming `GET /admin/fees/onchain[?tx_hash=…]` was
also added. See `docs/ADMIN_V2_FEE_OBSERVABILITY_V2E_H.md`.
