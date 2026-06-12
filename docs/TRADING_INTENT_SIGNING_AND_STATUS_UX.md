# Trading — Intent, Signing, and Status UX (M-P3c)

**Date:** 2026-06-10
**Posture:** local-only. **No mainnet. No live tx. No real wallet.
No admin Bearer. No `.env` edit.**

## 1. State machine — `SigningPhase`

```
  idle
   ↓ user clicks [Create intent]
  creating_intent
   ├─ backend OK         → (intent_id auto-fills; phase returns to idle)
   ├─ backend 404/405/501 → intent_pending  ←  amber sticky notice
   └─ network/other      → error
  intent_pending  (terminal until user retries or pastes intent_id)

  idle + intent_id present
   ↓ user clicks [Sign typed data]
  fetching_payload
   ├─ payload OK         → awaiting_signature
   ├─ malformed payload  → backend_unavailable
   └─ network            → backend_unavailable
  awaiting_signature
   ├─ wallet OK          → signed_ready → submitting
   ├─ wallet REJECT      → rejected
   ├─ wallet wrong-net   → wrong_network
   └─ wallet other       → error
  submitting
   ├─ POST OK            → submitted  →  router.push(`/transactions/:id`)
   └─ POST fail          → backend_unavailable
```

Every transition is explicit. Auto-signing is impossible.

## 2. UI affordances

| Affordance | Renders when | Hard-gated by |
|---|---|---|
| `[Create intent]` | Always in TradeTicket | wallet connected + expected chain |
| Create-pending amber notice | `createExecutionIntent` returns pending | — |
| Execution intent id field | Always in TradeTicket | — |
| `[Sign typed data]` | Always in TradeTicket | wallet + expected chain + intent_id present + signing enabled |
| `<SigningStateModal>` | Modal open | phase ≠ idle |
| `<TxStatusTimeline>` | `/transactions/:id` route | intent_id parsed from URL |

## 3. Forbidden behaviours

* No silent / auto-signing of typed data.
* No direct frontend broadcast.
* No mainnet RPC.
* No `Authorization` header from the trading UI runtime.
* No `/admin/test/*` fetch from the browser app.
* No production verifying-contract address hard-coded in code.

## 4. Error envelope rendering

`TradingApiError` carries `code` + `message` + `status`. The error
codes the trading UI maps to user-facing copy:

| `code` | User message |
|---|---|
| `INVALID_REQUEST` | "Check the form — one of the fields is invalid." |
| `SERIES_NOT_FOUND` | "Series no longer exists — refresh the chain." |
| `INSUFFICIENT_BALANCE` | "Not enough collateral to cover the trade." |
| `INSUFFICIENT_COLLATERAL` | "Not enough collateral — reduce size." |
| `QUOTE_UNSUPPORTED` | "Quote type not supported in this series." |
| `QUOTE_STALE` | "Quote expired — refresh the preview." |
| `NETWORK` | "Backend unreachable — check the dev server." |
| Any other | The raw `message` from the error envelope. |

## 5. Mainnet hard-gate

The trading UI refuses every interactive flow when the wallet reports
chain id 8453:

1. `<MainnetDisabledBanner>` renders sticky red across the trading
   layout.
2. `useWallet().isExpectedChain` returns false → both
   `[Create intent]` and `[Sign typed data]` buttons are disabled.
3. `signTypedData` refuses to dispatch with a typed reason
   `wrong_network`.
4. The Playwright `mainnet-disabled.spec.ts` asserts the banner is
   visible on chain 8453.

Defence-in-depth: even if one gate fails, the others still prevent
any wallet interaction.

## 6. Tx status follow-on

Once `submitted` is reached, navigation hands off to the existing
M-P3b/M-P4d tx-status flow:

* `TxStatusTimeline` polls `/options/execution-intents/:id` and
  `/executor/transactions/:id`.
* The 6 stages render as colored pills (CREATED → SIGNING_PAYLOAD_ISSUED
  → SIGNED → SIMULATED_OK → BROADCAST → CONFIRMED).
* REVERTED and STUCK render as red / amber banners.
* Polling stops when the status is terminal.

## 7. Cross-links

* `FRONTEND_CREATE_INTENT_UX_RESULT.md` (M-P3c result)
* `TRADING_CREATE_INTENT_FLOW_RUNBOOK.md` (operator runbook)
* `TRADING_TX_STATUS_WIRING.md`
* `TRADING_SIGNING_FLOW_RUNBOOK.md` (M-P3b)
* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_TX_STATUS_CYCLER_RUNBOOK.md`

**End of UX doc.**
