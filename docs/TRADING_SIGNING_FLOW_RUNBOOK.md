# Trading Signing Flow Runbook (M-P3b)

**Date:** 2026-06-10
**Audience:** frontend developers wiring + testing the signing flow.

## 1. The 10-phase modal

`src/components/tx/SigningStateModal.tsx` carries the visual state. The
parent (TradeTicket / RfqPanel) transitions through phases via
`setPhase(...)` calls.

```
idle
  └── user clicks "Sign"
fetching_payload
  ├── HTTP error → backend_unavailable
  └── 200 → continue
awaiting_signature
  ├── EIP-1193 code 4001 → rejected
  ├── wrong-network refusal → wrong_network
  ├── other error → error
  └── signature ok → submitting
submitting
  ├── HTTP error → backend_unavailable
  └── 200 → submitted (and router.push to /transactions/:id)
```

Closing the modal at any phase is a UI-only action — it does NOT cancel
any in-flight operation. Backend submissions are idempotent against the
intent_id.

## 2. Local development against anvil

```bash
# Terminal A — backend pointed at anvil
cd ~/DEOPT/deopt-v2-backend
DATABASE_URL=postgres://... cargo run

# Terminal B — frontend
cd ~/DEOPT/deopt-v2-frontend
NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:3000 \
NEXT_PUBLIC_CHAIN_ENV=anvil \
npm run dev

# Terminal C — anvil
anvil --chain-id 31337
```

In the trading UI:
1. Connect MetaMask / Rabby pointed at anvil (chain 31337).
2. Browse to `/markets/<productId>`.
3. Select a series in the option chain.
4. Paste a valid `intent_id` (obtained from the backend operator or
   the local test harness) into the "Execution intent id" field.
5. Click "Sign typed data".
6. Approve the EIP-712 envelope in your wallet.
7. UI navigates to `/transactions/<intent_id>` once submitted.

## 3. Local development against Prism mock

```bash
# Terminal A — Prism mock
cd ~/DEOPT
npx @stoplight/prism mock deopt-v2-backend/docs/openapi/trading-api.openapi.json --port 4010

# Terminal B — frontend
cd deopt-v2-frontend
NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:4010 \
NEXT_PUBLIC_CHAIN_ENV=sepolia \
npm run dev
```

Note: the M-P3b signing endpoints (`/options/execution-intents/*`)
are NOT in the OpenAPI spec yet (they predate the M-P2 envelope
convention). Against Prism, these calls return 404. The UI surfaces
this as `backend_unavailable`. To exercise the full signing flow,
use the real backend (Terminal A in §2).

## 4. Wallet rejection handling

The wallet typically returns EIP-1193 error code `4001` when the user
rejects in the prompt. The wallet context maps this to:

```ts
{ ok: false, reason: "rejected", message: "<wallet message>" }
```

The TradeTicket renders this as `phase = "rejected"`. Nothing is
posted to the backend. The user can dismiss the modal + retry.

## 5. Mainnet defence

When the user's wallet reports `chainId === 8453` (Base mainnet):

1. `useWallet().isMainnet === true`.
2. `MainnetDisabledBanner` shows red sticky.
3. `signTypedData` returns `{ ok: false, reason: "wrong_network" }`
   without prompting the wallet.
4. The TradeTicket's Sign button is gated on `isExpectedChain` so it's
   never clickable on mainnet anyway.

Three independent defences. Any one would prevent a mainnet signature.

## 6. Backend operator coordination

For a complete trade:
1. Backend operator creates the execution intent via internal
   mechanism (out of scope for this UI; M-P2c work).
2. Operator shares the `intent_id` with both buyer + seller (or both
   parties poll the backend).
3. Buyer pastes the intent_id into their TradeTicket, clicks Sign,
   signature posted as `buyer_signature`.
4. Seller does the same, posted as `seller_signature`.
5. Once both sigs are present, backend operator calls
   `POST /options/execution-intents/:id/broadcast` (operator-only —
   NOT reachable from the trading UI).
6. Both UIs see the intent status transition through `BROADCAST` →
   `CONFIRMED` on their `/transactions/:intent_id` page via the
   polling hook.

## 7. Failure-case rehearsal

| Scenario | Expected UI behaviour |
|---|---|
| User rejects signature in wallet | modal `phase = rejected` + "User rejected" detail; nothing posted |
| User connects wrong chain | sign button disabled; if clicked, `phase = wrong_network` |
| Backend returns 404 for signing-payload | modal `phase = backend_unavailable` + HTTP 404 detail |
| Backend returns 500 for signatures | modal `phase = backend_unavailable`; user can retry by re-clicking Sign (signature is fresh — idempotent) |
| Tx reverts on chain | TxStatusTimeline shows REVERTED row + `reverted_reason` from backend |
| Tx STUCK > timeout | TxStatusTimeline shows STUCK row + "operator review pending" |
| Wallet disconnected mid-flow | Sign button disables; modal can be closed |
| Indexer falls behind | tx-status hook continues polling; user sees stale STAGE until indexer catches up |

## 8. Sensitive-data hygiene

The signing flow never:
- writes the user's private key to disk;
- caches the signed message beyond the lifecycle of the current page;
- logs the signature or the message contents;
- exposes the admin Bearer token (the signing flow uses
  `trading-api.ts` which never sets Authorization headers);
- prompts the wallet without an explicit user click.

## 9. Cross-links

- `docs/FRONTEND_TRADING_SIGNING_RESULT.md`
- `docs/TRADING_TX_STATUS_WIRING.md`
- `docs/TRADING_UI_ROUTE_MAP.md`
- `docs/TRADING_UI_MOCK_API_RUNBOOK.md`
- `~/DEOPT/deopt-v2-backend/src/options/execution.rs` (canonical typed-data shapes)

**End of trading signing flow runbook.**
