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

## Validation Commands

Required frontend validation:

```text
npm run lint
npx tsc --noEmit
npm run build
```

## Notes

The current backend lifecycle response includes `metadata.strike_1e8`; the UI labels this as `Strike`. The requested `is_european` field is handled defensively and displays `n/a` when absent.
