# FRONTEND-TRADING-SIGNING — Result (M-P3b)

**Date:** 2026-06-10
**Stack:** Next.js 16.1.6 (Turbopack) + React 19.2.3 + TypeScript 5 + Tailwind 4 + **viem 2.x (added)**
**Posture:** **testnet beta; NOT YET AUDITED**. **Mainnet trading remains
hard-gated in code.** **No live transactions sent from the frontend.**
**Backend operator handles broadcast.**
**Status:** signing flow + intent submission + tx-status polling wired;
`npx tsc --noEmit` + `eslint` + `next build` all clean.

## 1. Scope

Adds the M-P3b layer on top of the M-P3 trading MVP:

- viem wallet client.
- EIP-712 typed-data builders aligned with the backend `OPTION_TRADE_TYPE` constant.
- Backend-issued signing-payload fetch (`/options/execution-intents/:id/signing-payload`).
- User-initiated `signTypedData` via the connected wallet (no auto-signing; no silent prompts).
- Signature submit (`/options/execution-intents/:id/signatures`) — **buyer or seller side only; frontend NEVER triggers broadcast**.
- Live tx status polling against `/options/execution-intents/:id` + `/executor/transactions/:intent_id`.
- Signing state modal with 10 visual phases.

## 2. Dependencies added

```diff
   "dependencies": {
     "next": "16.1.6",
     "react": "19.2.3",
-    "react-dom": "19.2.3"
+    "react-dom": "19.2.3",
+    "viem": "^2.52.2"
   }
```

`npm install --save viem` → "added 19 packages". Build size impact:
viem is tree-shaken; only the chain definitions (`anvil`, `baseSepolia`)
+ `createWalletClient` + `custom` + `signTypedData` actually reach the
production bundle.

## 3. Wallet client behavior (upgraded)

`src/lib/wallet.tsx` now constructs a viem `WalletClient` from the
injected EIP-1193 provider when the user connects. Surface:

```ts
interface WalletState {
  address: Address | null;
  chainId: number | null;
  isConnecting: boolean;
  hasProvider: boolean;
  isMainnet: boolean;
  isExpectedChain: boolean;
  walletClient: WalletClient | null;  // ← NEW
  connect: () => Promise<void>;
  disconnect: () => void;
  signTypedData: (args: SignTypedDataArgs) => Promise<SignResult>;  // ← NEW
}

type SignResult =
  | { ok: true; signature: `0x${string}` }
  | { ok: false; reason: "rejected" | "no_provider" | "wrong_network" | "error"; message?: string };
```

`signTypedData` is **strictly gated**:

1. Refuses if `walletClient === null` (no provider).
2. Refuses if `isMainnet` (mainnet hard-gate).
3. Refuses if `!isExpectedChain` (wrong network).
4. Maps wallet code `4001` (EIP-1193 user-rejection) to `{ ok: false, reason: "rejected" }`.
5. Returns the raw signature on success — the caller submits it to backend.

No auto-signing: every wallet prompt is triggered by an explicit `onClick` in the trade ticket / RFQ panel.

## 4. EIP-712 helpers

`src/lib/eip712.ts` upgraded:

| Export | Purpose |
|---|---|
| `OPTION_TRADE_TYPES` | matches backend `OPTION_TRADE_TYPE` constant (`src/options/execution.rs:19`) |
| `OPTION_RFQ_TRADE_TYPES` | matches backend `OPTION_RFQ_TRADE_TYPE` constant (`src/options/execution.rs:27`) |
| `adaptSigningPayload(payload)` | converts the backend envelope to the wallet-context `SignTypedDataArgs` shape |
| `buildPlaceholderTrade(args)` | local-dev builder with `verifyingContract = 0x0` (anvil-only fallback) |
| `isSigningEnabled()` | now returns `true` (was hard-coded `false` in M-P3) |

Backend-issued envelope is preferred. `buildPlaceholderTrade` is for
local development only and explicitly uses `0x0...0` as the verifying
contract so a wallet would refuse / the signature would not validate
on chain — defence-in-depth.

## 5. API client extensions

`src/lib/trading-api.ts`:

| Function | Endpoint | Notes |
|---|---|---|
| `fetchSigningPayload(intentId)` | `GET /options/execution-intents/:id/signing-payload` | uses `rawRequest` since legacy endpoint is not enveloped |
| `postSignatures(intentId, body)` | `POST /options/execution-intents/:id/signatures` | body = `{ buyer_signature? \| seller_signature? }` |
| `fetchExecutionIntent(intentId)` | `GET /options/execution-intents/:id` | returns `ExecutionIntentStatus` |
| `fetchExecutorTransaction(intentId)` | `GET /executor/transactions/:intent_id` | returns `ExecutorTransaction \| null` |

The trading client **never** sets an `Authorization` header for these
calls. The frontend **never** calls
`POST /options/execution-intents/:id/broadcast` — that endpoint is
operator-side and no UI code path reaches it.

## 6. Trade ticket flow

`src/components/trading/TradeTicket.tsx`:

```
1. user selects series + side + size + (optional limit price + intent id)
2. clicks "Sign typed data"
3. component calls fetchSigningPayload(intentId) ── modal: "fetching_payload"
4. component adapts backend envelope via adaptSigningPayload()
5. component calls walletClient.signTypedData(typed)  ── modal: "awaiting_signature"
6. on success: postSignatures(intentId, { buyer_signature | seller_signature })  ── modal: "submitting"
7. on backend ack: router.push(`/transactions/${intentId}`)  ── modal: "submitted"
```

If the user rejects in wallet (EIP-1193 code 4001): modal shows
"rejected"; nothing posted to backend.

If backend submit fails: modal shows "backend_unavailable"; nothing
broadcast; user can retry from the modal close → tx-status page.

**M-P3b deliberately collects the `intent_id` from a user input field**
(populated by the backend operator). M-P2c / M-P3c will add a "create
intent from quote preview" UX once the backend exposes a
`POST /options/intents/create-from-quote` endpoint; until then the
intent id is provided externally.

## 7. RFQ panel flow

`src/components/trading/RfqPanel.tsx`: same signing flow as TradeTicket
but for RFQ envelopes. Posts `buyer_signature` by default (the RFQ
taker is canonically the buyer). The maker side runs through the same
flow but posts `seller_signature`. The backend composes both before
broadcast.

## 8. TxStatusTimeline (M-P3b: real backend wiring)

`src/components/tx/TxStatusTimeline.tsx` now consumes the
`useTxStatus(intentId)` hook with composite data:

```ts
interface TxStatusComposite {
  intent: ExecutionIntentStatus | null;
  tx: ExecutorTransaction | null;
}
```

6-stage timeline: CREATED → SIGNING_PAYLOAD_ISSUED → SIGNED →
SIMULATED_OK → BROADCAST → CONFIRMED. Polls every 2 s while not
terminal; stops polling on CONFIRMED / REVERTED / STUCK. REVERTED rows
render with `reverted_reason` from the backend; STUCK rows render an
amber "operator review pending" notice.

## 9. UX states

Total 13 visual states across the signing flow + tx status:

| State | Surface | Source |
|---|---|---|
| pending wallet signature | `SigningStateModal` phase `awaiting_signature` | `walletClient.signTypedData` in flight |
| user rejected signature | `SigningStateModal` phase `rejected` | EIP-1193 code 4001 |
| typed-data unavailable | `SigningStateModal` phase `backend_unavailable` | `fetchSigningPayload` failed or returned empty |
| signed payload ready | `SigningStateModal` phase `signed_ready` | (transient between sign + submit) |
| submit pending | `SigningStateModal` phase `submitting` | `postSignatures` in flight |
| backend submit unavailable | `SigningStateModal` phase `backend_unavailable` | `postSignatures` HTTP error |
| intent submitted | `SigningStateModal` phase `submitted` + `/transactions/:id` navigation | 200 OK from `postSignatures` |
| tx pending | `TxStatusTimeline` non-terminal state | intent status ∈ {CREATED .. BROADCAST} |
| tx confirmed | `TxStatusTimeline` CONFIRMED row | intent status = CONFIRMED |
| tx failed (reverted) | `TxStatusTimeline` REVERTED row + reason | intent status = REVERTED |
| tx stuck | `TxStatusTimeline` STUCK row | intent status = STUCK |
| wrong network | `signTypedData` returns `{ ok: false, reason: "wrong_network" }` + `NetworkBadge` amber | wallet chainId mismatch |
| mainnet disabled | `MainnetDisabledBanner` red sticky + `signTypedData` refuses | wallet chainId = 8453 |

## 10. Safety banners (preserved + extended)

- `TestnetUnauditedBanner` sticky top — unchanged.
- `MainnetDisabledBanner` sticky red when isMainnet — unchanged.
- `signTypedData` returns `{ ok: false, reason: "wrong_network" }` if
  isMainnet OR not isExpectedChain — wallet prompt is NEVER opened on
  mainnet.
- TradeTicket explanatory text under Sign button: "Nothing is broadcast
  from the UI; the backend operator handles broadcast after both buyer
  + seller sign."
- RfqPanel explanatory text: "No transaction is sent. The backend
  operator handles broadcast."
- No silent wallet requests; no auto-signing anywhere.

## 11. Validations

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean (after fixing 1 readonly-tuple TS error in `OPTION_TRADE_TYPES` — added `Record<string, TypeField[]>` annotation) |
| `npx eslint src/` | clean (after fixing 1 React-19 `set-state-in-effect` warning in `useSigningPayload` — wrapped initial `setIsLoading(true)` in `Promise.resolve().then(...)` microtask) |
| `npx next build` | clean — "Compiled successfully in 3.5 s" Turbopack production; 9 routes (7 static, 2 dynamic) |
| `git diff --check` | clean |
| Sensitive-string scan against new + edited trading files | zero `EXECUTOR_PRIVATE_KEY` / `DATABASE_URL` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `sessionStorage` (sessionStorage matches only in unchanged `admin-rbac-types.ts`) |

## 12. Files changed

### New

| Path | Purpose |
|---|---|
| `src/components/tx/SigningStateModal.tsx` | 10-phase signing state modal |
| `docs/FRONTEND_TRADING_SIGNING_RESULT.md` | this doc |
| `docs/TRADING_SIGNING_FLOW_RUNBOOK.md` | operator/developer runbook |
| `docs/TRADING_TX_STATUS_WIRING.md` | tx status endpoint inventory + behavior |

### Edited

| Path | Change |
|---|---|
| `package.json` | added `viem: ^2.52.2` as a runtime dep |
| `src/lib/wallet.tsx` | viem upgrade; added `walletClient` + `signTypedData` |
| `src/lib/eip712.ts` | `isSigningEnabled() → true`; added `OPTION_TRADE_TYPES` + `OPTION_RFQ_TRADE_TYPES` + `adaptSigningPayload` |
| `src/lib/trading-types.ts` | added `SigningPayload`, `SubmitSignaturesRequest/Response`, `ExecutionIntentStatus`, `ExecutorTransaction` |
| `src/lib/trading-api.ts` | added `fetchSigningPayload`, `postSignatures`, `fetchExecutionIntent`, `fetchExecutorTransaction` |
| `src/hooks/trading.ts` | replaced placeholder `useTxStatus` with real composite poll; added `useSigningPayload` |
| `src/components/trading/TradeTicket.tsx` | full signing flow + intent_id input + router.push to tx-status page |
| `src/components/trading/RfqPanel.tsx` | RFQ envelope signing flow |
| `src/components/tx/TxStatusTimeline.tsx` | real backend polling with composite data |
| `docs/TRADING_UI_ROUTE_MAP.md` | (updated; signing flow wired) |
| `docs/TRADING_UI_MOCK_API_RUNBOOK.md` | (updated; mock posture for the new endpoints) |
| `docs/E2E_LOCAL_TRADING_LIFECYCLE_NEXT_TASK.md` | (updated; M-P3b prerequisite now closed; M-P4 still gated on M-P2b) |
| `RUN_STATE.md` | closure paragraph prepended |

### Unchanged

- `src/lib/chains.ts` — mainnet still gated.
- `src/lib/admin-api.ts` + `src/lib/admin-rbac-types.ts` — admin scope untouched.
- `src/app/admin/**` — admin routes untouched.
- `src/app/layout.tsx` — root layout untouched.

## 13. Blockers

None for M-P3b. Forward gates for M-P4:
- M-P2b (PARTIAL → on-chain refinement; 6 endpoints already return real data + warnings; M-P2c can elevate to `status: "ok"`).
- M-P4 still requires a backend that emits an `intent_id` from a quote-preview submission so the UI no longer asks the user to paste one — UX polish only.

## 14. Next milestone recommendation

**Serialised next:** `E2E-LOCAL-TRADING-LIFECYCLE` (M-P4) per
`docs/E2E_LOCAL_TRADING_LIFECYCLE_NEXT_TASK.md`. Stack: anvil +
postgres + backend + frontend + Playwright + viem; orderbook 9-step +
RFQ 7-step scenarios; 10 failure cases; R5 drift verification.

**In parallel:** `BACKEND-TRADING-API-IMPLEMENTATION-PHASE-3` (M-P2c) —
on-chain RPC orchestration to lift PARTIAL endpoints to OK.

Subsequent: M-P5 (E2E Sepolia) → M-P6 (public docs beta pack) → M-P7
(security review re-anchor) → unlocks `MAINNET-AUDIT-EXT-DISPATCH`.

## 15. Cross-links

- `~/DEOPT/deopt-v2-backend/docs/openapi/trading-api.openapi.json`
- `~/DEOPT/deopt-v2-backend/docs/FRONTEND_TRADING_API_HANDOFF.md`
- `~/DEOPT/deopt-v2-backend/docs/BACKEND_TRADING_API_PHASE_2_RESULT.md`
- `~/DEOPT/deopt-v2-backend/docs/BACKEND_TRADING_API_IMPLEMENTATION_RESULT.md`
- `~/DEOPT/deopt-v2-backend/src/options/execution.rs` (canonical `OPTION_TRADE_TYPE` + `OPTION_RFQ_TRADE_TYPE` constants)
- `~/DEOPT/deopt-v2-sol/abis/freeze-v2-product-rc1/`
- `docs/FRONTEND_TRADING_MVP_WIRING_RESULT.md` (M-P3 baseline)
- `docs/TRADING_SIGNING_FLOW_RUNBOOK.md` (this milestone)
- `docs/TRADING_TX_STATUS_WIRING.md` (this milestone)

**End of M-P3b trading signing result.**
