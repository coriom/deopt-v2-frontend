# Trading Tx Status Wiring (M-P3b)

**Date:** 2026-06-10
**Audience:** frontend developers + backend operators understanding the
trading UI's transaction status surface.

## 1. Endpoints consumed

| Endpoint | Used by | Polling |
|---|---|---|
| `GET /options/execution-intents/:id` | `useTxStatus` → `fetchExecutionIntent` | every 2 s while non-terminal |
| `GET /executor/transactions/:intent_id` | `useTxStatus` → `fetchExecutorTransaction` | every 2 s while non-terminal |
| `GET /options/execution-intents/:id/signing-payload` | `useSigningPayload` (one-shot) | n/a |
| `POST /options/execution-intents/:id/signatures` | `TradeTicket` / `RfqPanel` (one-shot on Sign) | n/a |

The frontend does NOT consume:
- `POST /options/execution-intents/:id/broadcast` — operator-only.
- `POST /options/execution-intents/:id/simulate` — operator-only.
- `POST /options/execution-intents/:id/confirm` — operator-only.

## 2. Composite hook surface

```ts
// src/hooks/trading.ts
export interface TxStatusComposite {
  intent: ExecutionIntentStatus | null;
  tx: ExecutorTransaction | null;
}

export function useTxStatus(intentId: string | null): HookResult<TxStatusComposite>
```

The hook fires both fetches in series per tick; either may legitimately
return `null` (e.g. `tx` is null until the operator broadcasts). The UI
handles each null gracefully.

## 3. Status enum + UI mapping

| `intent.status` | UI row in TxStatusTimeline |
|---|---|
| CREATED | first row highlighted (intent registered) |
| SIGNING_PAYLOAD_ISSUED | "signing payload issued" row |
| SIGNED | "signed" row (one or both parties have submitted) |
| SIMULATED_OK | "simulated" row |
| BROADCAST | "broadcast" row with tx_hash if present |
| CONFIRMED | green CONFIRMED row; polling stops |
| REVERTED | red REVERTED row with `reverted_reason`; polling stops |
| STUCK | amber STUCK row; polling stops; advises operator review |

## 4. Polling behaviour

- 2-second interval (`window.setInterval`).
- Stops on terminal: `CONFIRMED | REVERTED | STUCK`.
- Resumes on `refetch()` if needed.
- Each tick uses a fresh `AbortController`; navigating away cancels in-flight requests.

## 5. tx_hash + block_number surfacing

The composite footer renders:

```
intent_id    <uuid>
tx_hash      <0x… | —>
block        <number | —>
poll         every 2s | stopped (terminal)
```

This is informational only — there is no link out to a block explorer
in M-P3b (the chain id → explorer URL mapping lives in `src/lib/chains.ts`
and can be wired in a follow-on UX polish milestone).

## 6. Failure modes

| Scenario | Hook behaviour | UI behaviour |
|---|---|---|
| `intentId` unknown to backend | `intent === null && tx === null` | TxStatusTimeline shows CREATED-only with empty footer |
| Backend offline | both fetches throw; `error` set on hook | `<ErrorState>` displayed; user can manually `refetch` |
| Intent in INDEXER_STALE state | `intent.status` may lag chain by a few blocks | UI accepts (transient); polling resolves naturally |
| Tx STUCK | terminal; polling stops | amber row + "operator review pending" |

## 7. Performance notes

- The 2-second poll cadence is conservative. Real Sepolia / mainnet block times are 2-12 s.
- Per-tab polling cost: 2 HTTP requests / 2 s while non-terminal. On terminal: 0.
- Server cardinality: bounded by the number of open intents per user. No per-tx-hash labels added to backend metrics by this endpoint family.

## 8. Comparison to M-P3

| M-P3 (placeholder) | M-P3b (real) |
|---|---|
| `useState` placeholder returning `{ status: "pending", request_id }` | real composite poll against `/options/execution-intents/:id` + `/executor/transactions/:intent_id` |
| TxStatusTimeline: 4 hard-coded stages, no real data | TxStatusTimeline: 6 real stages mapped from backend; reverted_reason + tx_hash + block surfaced |
| no polling | 2-second poll while non-terminal |

## 9. Cross-links

- `docs/FRONTEND_TRADING_SIGNING_RESULT.md`
- `docs/TRADING_SIGNING_FLOW_RUNBOOK.md`
- `docs/TRADING_UI_ROUTE_MAP.md`
- `~/DEOPT/deopt-v2-backend/docs/openapi/trading-api.openapi.json` (note: these legacy endpoints are NOT yet in the OpenAPI spec; M-P2c will add them)

**End of trading tx status wiring.**
