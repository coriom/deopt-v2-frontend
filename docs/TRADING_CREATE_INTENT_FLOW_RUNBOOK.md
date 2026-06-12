# Trading — Create-Intent Flow Runbook (M-P3c)

**Date:** 2026-06-10
**Audience:** frontend / QA developers running the trade-ticket
create-intent → sign → submit → tx-status flow locally.
**Posture:** local-only. **No mainnet. No live tx. No real wallet.
No real broadcast. No admin Bearer in the trading UI.**

## 1. Two-step flow

```
Step 1 — Create intent
  ├─ wallet connected on testnet?       → enables [Create intent]
  ├─ button click
  │   ├─ backend has POST endpoint     → intent_id auto-fills
  │   └─ backend returns 404/405/501  → amber notice + paste fallback
  └─ paste path remains for operator flows

Step 2 — Sign typed data
  ├─ intent_id present?                → enables [Sign typed data]
  ├─ button click
  │   ├─ fetchSigningPayload(intentId)
  │   ├─ adaptSigningPayload (validates)
  │   ├─ wallet.signTypedData(typed)
  │   │   ├─ user accepts → signed_ready
  │   │   ├─ user rejects → rejected modal
  │   │   └─ wrong network → wrong_network modal
  │   ├─ postSignatures(intentId, { buyer_signature | seller_signature })
  │   └─ router.push(`/transactions/${intentId}`)
  └─ TxStatusTimeline polls CREATED → BROADCAST → CONFIRMED
```

## 2. Backend dependency

The current backend (M-P2e) does **not** expose a public POST handler
for `/options/execution-intents`. `createExecutionIntent` detects this
via 404/405/501 and surfaces `BACKEND_ENDPOINT_PENDING`. The UI then
shows an amber notice + the legacy paste path.

When the backend ships the public POST endpoint:
1. The amber notice will not render.
2. The intent_id field will auto-fill from the response.
3. No frontend changes are required.

## 3. Running locally

```bash
cd ~/DEOPT/deopt-v2-frontend
npm install
npm run dev
# Visit http://localhost:3000
```

Optionally, point at a Prism mock backend:

```bash
npx @stoplight/prism mock \
  ~/DEOPT/deopt-v2-backend/docs/openapi/trading-api.openapi.json --port 4010

NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:4010 npm run dev
```

Note that the OpenAPI spec does not yet include `POST
/options/execution-intents`, so Prism will return 404 for the create
attempt — exercise the pending path.

## 4. Playwright

The full E2E suite is in `tests/e2e/`. M-P3c adds
`create-intent.spec.ts` (5 specs). Run:

```bash
npm run e2e:install   # one-time chromium download
npm run e2e:local     # all 21 specs
```

`tests/e2e/create-intent.spec.ts` uses `page.route` interception only
— no backend required.

## 5. Defence-in-depth (what is never permitted)

* The trading UI never fetches `/admin/test/*` from the browser
  runtime (asserted by `no-admin-bearer.spec.ts` + per-spec guards
  in `tx-status-cycler.spec.ts`).
* The trading UI never attaches an `Authorization: Bearer …` header.
* No production verifying-contract address is hard-coded in the
  frontend — EIP-712 domain comes from the backend.
* Mainnet (chain 8453) is permanently disabled by 4 gates: chain
  detection, `MainnetDisabledBanner`, `isExpectedChain` flag,
  `signTypedData` refusal.

## 6. Cross-links

* `FRONTEND_CREATE_INTENT_UX_RESULT.md` (M-P3c result)
* `TRADING_INTENT_SIGNING_AND_STATUS_UX.md` (companion UX doc)
* `TRADING_SIGNING_FLOW_RUNBOOK.md` (M-P3b)
* `TRADING_TX_STATUS_WIRING.md`
* `TRADING_E2E_FIXTURE_MODE_RUNBOOK.md` (M-P4d)
* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_TX_STATUS_CYCLER_RUNBOOK.md` (backend M-P4c)

**End of runbook.**
