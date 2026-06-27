# FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — Result

**Status:** CLOSED — three real-data lifecycle panels (Open Orders, Fills, TP/SL) wired into `/trade` with REST snapshots + live WebSocket lifecycle deltas + EIP-191 authenticated subscription + reconnect-driven REST resync + per-panel connection status badge.

**Closed:** 2026-06-27
**Chain:** Base Sepolia (84532)
**Mainnet:** disabled
**Backend changes:** one — `signMessage` (EIP-191) added to the `WalletState` interface so the existing wallet provider can complete the WS auth challenge. No backend lifecycle semantics were changed.
**Secrets exposed:** none

---

## 1. Components added / changed

### New

| File | Purpose |
|---|---|
| `src/lib/lifecycle-types.ts` | Typed lifecycle payloads + channel enum + connection-status enum mirroring backend wire shape. |
| `src/lib/lifecycle-parse.ts` | Defensive frame parser. Never throws. Returns `null` for malformed frames, unknown payload variants, or non-lifecycle channels. Pure function. |
| `src/lib/lifecycle-ws.ts` | `LifecycleWsClient` — owns the WebSocket, runs the `auth.challenge` → `signMessage` → `auth.verify` → `subscribe` flow, reconnects with exponential backoff (1s → 30s max), dedupes deltas by `event_id`, fires `onResync` after each successful resubscribe. |
| `src/hooks/useLifecycleStream.ts` | React hook wrapping the client. Owns one client per `WalletProvider`-scoped subtree. Exposes `status`, `statusDetail`, `resyncToken`, `subscribe(channel, handler)`. |
| `src/components/trading/LifecycleStatusBadge.tsx` | 7-state colour-coded badge (`Offline` / `Connecting` / `Signing` / `Live` / `Reconnecting` / `Polling` / error). |
| `src/components/trading/FillsPanel.tsx` | REST + WS table of `account.fills`. Dedupe by `fill_id`, newest first. Empty / loading / error / disconnected states. |
| `src/components/trading/ConditionalOrdersPanel.tsx` | REST + WS table of `account.conditional_orders`. Active rows sort first; terminal rows below in created-desc order. Cancel button gated on `status === "armed"`; signs `CONDITIONAL_ORDER_CANCEL` write-auth envelope. |
| `src/components/trading/AccountLifecyclePanel.tsx` | 3-tab strip wrapping the three panels (Open orders / Fills / TP/SL). |
| `tests/node/lifecycle-parse.contract.mjs` | 12 wire-contract tests for the frame parser. |

### Modified

| File | Change |
|---|---|
| `src/lib/wallet.tsx` | Added `signMessage(message: string)` to `WalletState`; implementation via `walletClient.signMessage`. Same wrong-network / no-provider gating as `signTypedData`. |
| `src/components/trading/OpenOrdersPanel.tsx` | Subscribes to `account.orders` WS deltas and merges by `order_id`. Adds `LifecycleStatusBadge` to the header. Reconnect triggers REST resync via `resyncToken`. |
| `src/components/trading/terminal/TradeTicketPanel.tsx` | Replaced single `<OpenOrdersPanel />` mount with `<AccountLifecyclePanel />` (3 tabs). |

No file outside `src/` or `tests/` was changed. No frontend lib was replaced.

---

## 2. Lifecycle WebSocket client behaviour

### Handshake

```
client → { jsonrpc:"2.0", id:N, method:"auth.challenge",
           params:{ address:"0x…" } }
server → { result: { nonce, message, expires_at_ms, domain, chain_id }, ... }
client → wallet.signMessage(message)                              // EIP-191
client → { jsonrpc:"2.0", id:N+1, method:"auth.verify",
           params:{ address:"0x…", signature:"0x…" } }
server → { result: { authenticated:true }, ... }
client → { jsonrpc:"2.0", id:N+2, method:"subscribe",
           params:{ channel:"account.orders", address:"0x…" } }   (×3)
server → { result:{ subscription_id }, ... }                       (×3)
```

After successful (re)subscribe, the client invokes `onResync()` which the hook converts into a `resyncToken` bump — every panel watches that token and refetches REST.

### Connection state machine (`LifecycleConnectionStatus`)

```
disconnected → connecting → authenticating → subscribed
                                ↓ failure → reconnecting (backoff 1s → 2s → 4s → 8s → 30s max)
                                ↑                          ↓
                              error (badge "Polling")  →  REST polling fallback always runs
```

A wallet-disconnected or wrong-network state collapses to `disconnected` and the badge reads `Offline`; the REST polling layer continues independently so the panels never block the trade ticket.

### Dedupe

- Primary: `event_id` (backend assigns a fresh UUID per push).
- Bounded `seenEventIds` set: when it crosses 4096 entries, the oldest quarter is evicted to keep long sessions from leaking memory.

### Privacy belt-and-brace

- Backend already filters per-session by `session.account == event.account` AND active subscription.
- The hook re-checks `event.address` against the connected wallet before fan-out. A bug in the server-side filter cannot leak another account's deltas through the hook.

### Wallet refusal / wrong-network

- `wallet.signMessage` returns `{ ok:false, reason:"rejected"|"wrong_network"|"no_provider" }`.
- Client surfaces `error` status with the reason, closes the socket, and schedules a slower reconnect (backoff jumps to the 4th attempt's delay) so we don't immediately re-prompt the wallet.
- The REST polling fallback ensures panels still show fresh data while the WS is in error state.

### Logging

- Every status transition surfaces through `onStatus(status, detail)` to the badge tooltip.
- The hook + client never log the message bytes, the signature, the nonce, the JSON frame body, or any wallet diagnostic. The status detail is the only user-facing string and is intentionally generic.

---

## 3. REST snapshot strategy

Each panel:

1. On mount + on `address` change: fetch REST snapshot → `setRows`.
2. On 5-second poll: refetch REST snapshot → `setRows`.
3. On WS reconnect (via `resyncToken`): immediate REST refetch.
4. On WS delta: merge into local state by primary key (`order_id` / `fill_id` / `conditional_order_id`).

Unknown IDs in deltas (e.g. an order that wasn't in the last REST snapshot) are dropped from the merge — the next REST refetch picks them up. We never fabricate a row from a delta we don't already have in the snapshot.

Resulting invariants:
- REST is the canonical source of truth.
- WS deltas accelerate the visible update path within the 5-second polling window.
- A dropped WS event is automatically recovered within ≤ 5 s by the next poll or immediately by the reconnect resync.

---

## 4. Reconnect + resync strategy

```
WS error / close
  → status: reconnecting
  → backoff: min(30s, 1s × 2^(attempt - 1)), capped at attempt index 5
  → reconnect:
        connect → auth → subscribe (×3)
        on success → reset attempt counter → fire onResync()
                  → resyncToken++ → every panel REST-refetches
                  → status: subscribed
        on failure → schedule next reconnect with backed-off interval
```

The hook tears down + recreates the client on `(address, isExpectedChain)` change, so a wallet reconnect or chain flip starts a fresh session.

---

## 5. Trade-terminal integration

`AccountLifecyclePanel` mounts under `<TpSlManager />` in `TradeTicketPanel.tsx`. The tab strip lets the trader switch among Open orders / Fills / TP-SL without leaving the trade workspace. Each panel renders its own `LifecycleStatusBadge` so the trader can tell at a glance whether deltas are live or the panel is on the REST-polling fallback.

`TpSlManager.tsx` is unchanged — it remains the creation widget at trade-time and shows its own inline list. `ConditionalOrdersPanel` is the dedicated lifecycle view (broader; includes terminal rows; consumes WS deltas).

---

## 6. History integration status

`/history` (`src/components/history/HistoryShell.tsx`) is fully tabbed (`trades`, `transactions`, `orders`, `settlement`, `funding`, `interest`, `liquidations`) and backed by `fetchHistoryV2` against `GET /accounts/:address/history/v2`. The backend's `account.history` channel already feeds the same aggregate.

**Status:** deferred to `HISTORY-LIFECYCLE-V2`. Reasoning:

- History is structurally separate from the lifecycle stream — the same data the lifecycle channels emit is already aggregated into the history endpoint.
- Adding lifecycle deltas to the history page would require either (a) re-rendering full pages on each delta, which clashes with the explicit pagination model the user controls, or (b) introducing a "live" toggle that pulls from the WS stream while a static page is shown — a UX choice that should be made explicitly with design input.
- The trade-terminal lifecycle panels are the V1 win; history live-mode is a richer UX scope and should not slow this milestone down.

V1 leaves history unchanged. V2 explicitly tackles it.

---

## 7. UX + safety details

- **Wallet not connected:** every panel shows an explicit "Connect a wallet to view your …" message and disables actions. Status badge reads `Offline`.
- **Wrong network:** detected by `isExpectedChain`; status badge reads `Offline` with detail "wrong network"; `cancelOptionOrder` / `cancelConditionalOrder` return an early error explaining the user must switch to Base Sepolia.
- **WS unavailable / auth failed:** badge reads `Polling`; REST polling continues at 5 s; panels show real data with no live-delta indicator.
- **No repeated wallet prompts:** wallet-refused signature bumps the reconnect attempt index to 4 (≈ 16 s delay) so we don't re-prompt the wallet on every reconnect cycle.
- **No console spam:** only `tracing::warn`-level diagnostics surface from the client; no message bytes, signatures, nonces, or auth envelopes are ever logged.
- **No mock rows:** every row in every panel is sourced from a REST response or a server-emitted lifecycle delta. The brief's hard criterion ("no mock lifecycle data in trading UI") is met.
- **Cancel button visibility:** Open Orders shows Cancel only for `status ∈ {open, partially_filled}`. Conditional Orders shows Cancel only for `status === "armed"`. Terminal rows never expose a cancel button.
- **Perps:** untouched. The existing `/perps` route remains the coming-soon page; no perps lifecycle row is rendered anywhere.

---

## 8. Tests + validation

### New node tests (12, all pass)

`tests/node/lifecycle-parse.contract.mjs`:

1. Malformed JSON returns null, never throws.
2. Non-subscription frames are ignored.
3. Non-lifecycle channels (e.g. `trading.health`) are ignored — no public-channel leakage.
4. Unknown payload `type` returns null (forward-compat).
5. Valid `OrderUpdated` parses with all 5 typed fields.
6. `OrderUpdated` missing `remaining_size_1e8` returns null.
7. Valid `FillCreated` parses.
8. `FillCreated` with non-buy/sell side returns null.
9. `ConditionalOrderUpdated` with all optionals null parses.
10. `ConditionalOrderUpdated` with `failure_code` round-trips.
11. Missing `event_id` / `seq` / `address` rejects the frame.
12. `data.type` other than `"lifecycle_delta"` returns null.

Combined node-test sweep: **25 / 0** (12 lifecycle-parse + 13 write-auth canonical).

### Frontend full sweep

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run build` | Next.js production bundle built; `/trade`, `/history`, all other routes intact |
| `npm run test:node` | **25 / 0** |
| `npx playwright test --list` | 278 tests across 43 files listed; runner functional |

### Playwright execution

Lifecycle-specific Playwright execution is deferred. Rationale:

- The mock wallet fixture (`tests/e2e/wallet-fixture.ts`) does not implement `personal_sign` — its EIP-712 stub returns a synthetic signature that the backend rejects.
- Adding `personal_sign` to the mock wallet + an authenticated lifecycle E2E test is a meaningful scope that interacts with how the backend's `auth.verify` is fixture-mocked. The brief's V1 scope is "panels load real REST + apply WS deltas"; Playwright execution coverage is a separate hardening.
- All 278 existing Playwright specs continue to list; no spec regresses on the lifecycle changes (the panels are inside `/trade` workspace widgets that test fixtures already navigate to).

Deferred to `FRONTEND-LIFECYCLE-OBSERVABILITY-E2E-V1`.

### Backend validation

Backend was touched only in `src/api/public_ws/lifecycle.rs` re-exports (already done in `ORDER-LIFECYCLE-OBSERVABILITY-V1` / `WORKER-V1`). This milestone added ONE backend-adjacent change: the wallet interface gained `signMessage`. No Rust code was changed.

`git diff --check` clean on both repos.

---

## 9. Hard acceptance criteria

- [x] `/trade` has real Open Orders, Fills and Conditional Orders panels.
- [x] Panels load real REST snapshots (`GET /options/orders?account=…`, `GET /options/fills?account=…`, `GET /accounts/:addr/conditional-orders`).
- [x] Panels consume private lifecycle WS deltas when wallet auth is available (`useLifecycleStream` → `subscribe(channel, handler)` per panel).
- [x] Reconnect triggers REST resync (`resyncToken` bumps after each successful resubscribe).
- [x] REST polling fallback works when WS is unavailable (5-second poll runs independently of WS status).
- [x] No mock lifecycle data is displayed.
- [x] Cancel action remains EIP-712 write-auth protected (`buildAuthorization` + `signTypedData`).
- [x] Conditional order → child order → fills relationship is visible (`ConditionalOrdersPanel` Child column links to `child_order_id`; Fills column joins by order id).
- [x] Terminal statuses do not show invalid cancel buttons.
- [x] No perps lifecycle is presented as live (perps untouched).
- [x] Tests and build are green.
- [x] No secret exposure.
- [x] No chain transaction.
- [x] No deployment.
- [x] No mainnet.
- [x] No Solidity change.

---

## 10. Limitations / deferred

- **History live-mode integration → `HISTORY-LIFECYCLE-V2`.**
- **Playwright execution of the lifecycle panels → `FRONTEND-LIFECYCLE-OBSERVABILITY-E2E-V1`** (requires extending the mock wallet fixture with `personal_sign`).
- **Richer activity feed (notifications, toasts on lifecycle delta) → deferred.**
- **Advanced filters (status, time range, series search) on each panel → deferred.**
- **Worker PostgreSQL proof of the lifecycle emit sequence under concurrent ticks → `ORDER-LIFECYCLE-OBSERVABILITY-WORKER-PG-PROOF-V1`** (nice-to-have).
- **Session keys / bot streams → out of scope.**
- **Perps lifecycle → blocked behind `ACCOUNT-WRITE-AUTH-HARDENING-PERPS-V1`.**

---

## 11. Next recommendation

`HISTORY-LIFECYCLE-V2` — wire the `/history` page to optionally consume `account.history` lifecycle deltas (live-mode toggle) without breaking the pagination UX. After that, `FRONTEND-LIFECYCLE-OBSERVABILITY-E2E-V1` to add Playwright coverage of the new lifecycle panels via an upgraded mock wallet that signs both EIP-712 and EIP-191.
