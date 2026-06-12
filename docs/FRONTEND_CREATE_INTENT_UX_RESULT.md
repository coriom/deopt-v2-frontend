# FRONTEND_CREATE_INTENT_UX_RESULT (M-P3c)

**Date:** 2026-06-10
**Milestone:** `FRONTEND-CREATE-INTENT-UX` (M-P3c)
**Posture:** local-only. **No mainnet. No live tx. No direct frontend
broadcast. No real wallet. No admin Bearer in trading UI.
No `.env` edit.**

## 1. Purpose

Wire the trading UI from quote-preview through create-intent, EIP-712
signing, signed-intent submit, and tx-status navigation. Closes
**B3 FRONTEND_CREATE_INTENT_UX_MISSING**. Degrades cleanly when the
public create-intent backend endpoint is pending.

## 2. Files changed

| Path | Status |
|---|---|
| `src/lib/trading-api.ts` | edited — `createExecutionIntent` + 3 typed result variants |
| `src/components/tx/SigningStateModal.tsx` | edited — 2 new phases (`creating_intent`, `intent_pending`) |
| `src/components/trading/CreateIntentButton.tsx` | new |
| `src/components/trading/TradeTicket.tsx` | edited — Step 1/Step 2 layout + create-pending banner |
| `tests/e2e/create-intent.spec.ts` | new (5 specs) |
| `docs/FRONTEND_CREATE_INTENT_UX_RESULT.md` | new (this doc) |
| `docs/TRADING_CREATE_INTENT_FLOW_RUNBOOK.md` | new |
| `docs/TRADING_INTENT_SIGNING_AND_STATUS_UX.md` | new |

## 3. Current create-intent UX gap (resolved)

**Before M-P3c**: TradeTicket required the user to paste a UUID into
the "Execution intent id" field by hand — there was no UI affordance
to mint an intent from the quote. The signing flow refused to start
until the field had a value.

**After M-P3c**: a dedicated `<CreateIntentButton>` mints the intent
via the natural REST endpoint (`POST /options/execution-intents`).
The legacy paste path remains visible as a fallback when the backend
endpoint is pending — but the field is now labelled "auto-filled when
backend creates it" and is no longer the primary affordance.

## 4. API client extensions

`src/lib/trading-api.ts`:

```ts
export interface CreateExecutionIntentRequest {
  series_id: string;
  side: "buy" | "sell";
  size_1e8: string;
  price_1e8: string;
  buyer?: string;
  seller?: string;
}
export type CreateExecutionIntentResult =
  | { status: "ok"; data: { intent_id: string; status: string } }
  | { status: "pending"; code: "BACKEND_ENDPOINT_PENDING"; message: string };

export async function createExecutionIntent(
  body: CreateExecutionIntentRequest,
  signal?: AbortSignal,
): Promise<CreateExecutionIntentResult>;
```

Detection rules:
- `200 OK` with `intent_id` → `status: "ok"`.
- `404 / 405 / 501` → `status: "pending"` with `code:
  "BACKEND_ENDPOINT_PENDING"` (the public endpoint is not yet wired).
- Any other status (400, 422, etc.) → throws `TradingApiError`
  (real validation error; propagates to the parent's error handler).

The current backend (as of M-P2e) does NOT expose a public POST for
`/options/execution-intents`. The UI degrades gracefully via the
pending path; operator-side and M-P4c fixture flows still mint
intents.

## 5. EIP-712 payload handling

The existing M-P3b flow is preserved unchanged:

1. `fetchSigningPayload(intentId)` returns the backend-issued domain +
   types + message.
2. `adaptSigningPayload(payload)` validates the shape; throws on
   missing fields.
3. `signTypedData(typed)` opens the wallet.
4. The wallet client refuses on the wrong network OR on mainnet (4
   independent gates).
5. The user explicitly clicks "Sign" — **never auto-signed**.

No production verifying-contract addresses are hard-coded; everything
comes from the backend response. The frontend rejects any payload
missing `types` or `domain`.

## 6. Trade ticket flow

```
┌─────────────────────────────┐
│ Step 1 — Create intent      │
│                             │
│ [Create intent]             │
│  Backend → intent_id        │
│  ─────────                  │
│  pending? → amber notice +  │
│    paste fallback           │
│                             │
│ Execution intent id: [____] │
└─────────────────────────────┘
            ↓
┌─────────────────────────────┐
│ Step 2 — Sign typed data    │
│                             │
│ [Sign typed data]           │
│  → fetchSigningPayload()    │
│  → wallet signTypedData()   │
│  → postSignatures()         │
│  → /transactions/:intentId  │
└─────────────────────────────┘
```

* No auto-sign. No silent signing. No direct frontend broadcast.
* Both buttons are hard-gated by `useWallet().isExpectedChain`.
* On mainnet, `<MainnetDisabledBanner>` (M-P3b) renders sticky red
  AND `isExpectedChain` returns false, so both buttons are disabled.

## 7. UX states

| Phase | Trigger | Visual |
|---|---|---|
| `idle` | Modal closed | — |
| `creating_intent` | Create-intent button clicked | amber pulsing |
| `intent_pending` | Backend returned 404/405/501 | amber static |
| `fetching_payload` | Sign clicked | amber pulsing |
| `awaiting_signature` | Payload fetched | amber pulsing |
| `signed_ready` | Wallet returned signature | green |
| `submitting` | POSTing signature | amber pulsing |
| `submitted` | Backend accepted | green → navigates to `/transactions/:id` |
| `rejected` | Wallet rejected | red |
| `wrong_network` | Wallet on wrong chain | red |
| `backend_unavailable` | Signing payload / submit endpoint failed | red |
| `error` | Anything else | red |

Two new phases added in M-P3c: `creating_intent`, `intent_pending`.

## 8. Tx status integration

After `postSignatures` succeeds, `router.push(/transactions/:intentId)`
is called and the existing `TxStatusTimeline` + `useTxStatus` polling
takes over. The intent_id is stored only in component-local state
(never in localStorage / window scope / cookies). The Playwright
M-P4d dual-mode pattern works unchanged — fixture mode through the
M-P4c cycler OR fallback route interception, both translating into
the same `useTxStatus` wire shape.

## 9. Playwright updates

`tests/e2e/create-intent.spec.ts` (new) — 5 specs:

1. `trade-ticket-less home loads without admin Bearer leaks` — visits
   `/` with the wallet fixture installed; asserts zero
   `Authorization` headers and zero `/admin/test/*` requests from the
   app runtime.
2. `mainnet wallet still disables trading flow` — installs wallet on
   chain 8453; asserts `<MainnetDisabledBanner>` is visible.
3. `createExecutionIntent client returns 'pending' on 404` — route-intercepts
   `POST /options/execution-intents` with 404; verifies the client
   surface emits a pending result.
4. `createExecutionIntent client maps a successful response` —
   route-intercepts with 200 + a synthetic intent_id; verifies the
   client decodes it.
5. `tx-status page renders the synthetic CONFIRMED state via route
   intercept` — reuses the M-P4d translator for `/options/execution-intents/:id` +
   `/executor/transactions/:id`; asserts CONFIRMED stage renders.

Total Playwright suite now: **21 specs across 10 files** (was 16
across 9 at M-P4d → +5 specs in 1 file).

## 10. Docs created

* `docs/FRONTEND_CREATE_INTENT_UX_RESULT.md` (this doc)
* `docs/TRADING_CREATE_INTENT_FLOW_RUNBOOK.md`
* `docs/TRADING_INTENT_SIGNING_AND_STATUS_UX.md`

Backend-side: `~/DEOPT/deopt-v2-backend/docs/E2E_SEPOLIA_TRADING_LIFECYCLE_NEXT_TASK.md`
(new — M-P5 brief).

## 11. RUN_STATE update

`/home/corio/DEOPT/RUN_STATE.md` — M-P3c closure paragraph prepended.

## 12. Files changed (full list)

See Section 2.

## 13. Validations

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src/ tests/` | exit 0 |
| `npx next build` | exit 0 (9 routes) |
| `npx playwright test --list` | 21 specs across 10 files |
| `npx playwright test` (browser run) | NOT RUN — requires `npm run e2e:install` |
| `git diff --check` | clean |
| Sensitive-string scan on new/edited files | zero leaks |

## 14. Blockers

| Blocker | Status |
|---|---|
| B1 LOCAL_INTENT_FIXTURE_MISSING | closed (M-P4c) |
| B2 ON_CHAIN_RPC_NOT_WIRED | closed (M-P2e) |
| B3 FRONTEND_CREATE_INTENT_UX_MISSING | **CLOSED (this milestone)** |
| B4 NO_TEST_FRAMEWORK | partially closed (M-P4b) — chromium download remains operator-side |
| B5 BACKEND_TX_STATUS_FIXTURE_MISSING | closed (M-P4c) |
| B6 LOGO_NOT_IN_NAV | closed (M-P4b) |
| **B7 PUBLIC_CREATE_INTENT_ENDPOINT_PENDING** | **NEW** — public POST `/options/execution-intents` not yet wired on backend; UI degrades to paste path. Recommended close as part of M-P5 backend prep. |

## 15. Next milestone recommendation

**Recommended next:** `E2E-SEPOLIA-TRADING-LIFECYCLE` (M-P5). Brief at
`~/DEOPT/deopt-v2-backend/docs/E2E_SEPOLIA_TRADING_LIFECYCLE_NEXT_TASK.md`.

* M-P5 is **dry-run first**, **operator-approval-gated** for any
  Sepolia broadcast.
* No mainnet, no Safe tx, no AWS/KMS, no production `.env` edit.
* Closes the loop on the end-to-end testnet rehearsal.

**Then:** M-P6 → M-P7 → MAINNET-AUDIT-EXT-DISPATCH.

## 16. Cross-links

* `~/DEOPT/deopt-v2-backend/docs/BACKEND_TRADING_API_PHASE_5_RESULT.md` (M-P2e)
* `~/DEOPT/deopt-v2-backend/docs/FRONTEND_CREATE_INTENT_UX_NEXT_TASK.md` (origin brief)
* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_TX_STATUS_CYCLER_RESULT.md` (M-P4c)
* `docs/FRONTEND_PLAYWRIGHT_TX_STATUS_CYCLER_WIRING_RESULT.md` (M-P4d)
* `docs/TRADING_CREATE_INTENT_FLOW_RUNBOOK.md` (this milestone)
* `docs/TRADING_INTENT_SIGNING_AND_STATUS_UX.md` (this milestone)

**End of result doc.**
