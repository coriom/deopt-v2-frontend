# OPTIONS-FRONTEND-TRADING-INTEGRATION-V1 — TERMINAL FRONTEND CLOSURE

Terminal frontend integration for the now-complete Options Hybrid V2
backend. Every user-facing trading surface consumes the canonical
backend product; nothing is fabricated client-side.

**Next stage is E2E closure only** —
`OPTIONS-V1-FINAL-E2E-CLOSURE`. No further backend Options
milestone is authorized.

## HEADs

- Frontend: `83e68a8` → see git log
- Backend: `50df42e` → `50df42e` (untouched)
- Solidity: `f080272` → `f080272` (untouched)

## Delivered verdicts

- ✅ `OPTIONS_FRONTEND_CURRENT_SURFACE_AUDITED`
- ✅ `OPTIONS_FRONTEND_API_CONTRACT_ALIGNED`
- ✅ `OPTIONS_FRONTEND_SUBACCOUNT_INTEGRATION_VALIDATED`
- ✅ `OPTIONS_FRONTEND_MARKET_SELECTION_OPERATIONAL`
- ✅ `OPTIONS_FRONTEND_ORDERBOOK_OPERATIONAL`
- ✅ `OPTIONS_FRONTEND_TRADE_WIDGET_OPERATIONAL`
- ✅ `OPTIONS_FRONTEND_ORDER_PREVIEW_VALIDATED`
- ✅ `OPTIONS_FRONTEND_ORDER_SIGNING_AND_SUBMISSION_OPERATIONAL`
- ✅ `OPTIONS_FRONTEND_ORDER_LIFECYCLE_UX_VALIDATED`
- ✅ `OPTIONS_FRONTEND_OPEN_ORDERS_OPERATIONAL`
- ✅ `OPTIONS_FRONTEND_PENDING_SETTLEMENT_UX_VALIDATED`
- ✅ `OPTIONS_FRONTEND_CANONICAL_POSITIONS_OPERATIONAL`
- ✅ `OPTIONS_FRONTEND_HISTORY_V2_OPERATIONAL`
- ✅ `OPTIONS_FRONTEND_WS_LIVE_STATE_VALIDATED`
- ✅ `OPTIONS_FRONTEND_FAILURE_STATES_VALIDATED`
- ✅ `OPTIONS_FRONTEND_RFQ_BOUNDARY_VALIDATED`
- ✅ `OPTIONS_FRONTEND_TRADING_UX_VALIDATED`
- ✅ `OPTIONS_FRONTEND_TRADING_TEST_MATRIX_VALIDATED`
- ✅ `OPTIONS_FRONTEND_BACKEND_CONTRACT_SMOKE_VALIDATED`
- ✅ `OPTIONS_FRONTEND_RUNTIME_PERFORMANCE_VALIDATED`
- ✅ `OPTIONS_FRONTEND_SECURITY_VALIDATED`
- ✅ `OPTIONS_FRONTEND_REGRESSION_GREEN`
- ✅ `OPTIONS_FRONTEND_TRADING_INTEGRATION_V1_COMPLETE`

Terminal:
- ✅ `OPTIONS_V1_FULLSTACK_TRADING_FLOW_READY`
- ✅ `READY_FOR_OPTIONS_V1_FINAL_E2E_CLOSURE`

## Part A — current surface audit

Every Options user-facing route already exists and consumes the real
backend. Full inventory:

| Route | File | State |
|---|---|---|
| `/options` | `src/app/(trading)/options/page.tsx` | REAL (resizable widget workspace, `SelectedOptionProvider`) |
| `/trade` | `src/app/(trading)/trade/page.tsx` | REAL (legacy redirect → `/options`) |
| `/history` | `src/app/(trading)/history/page.tsx` | REAL (tabbed history) |
| `/rfq-strategy` | `src/app/(trading)/rfq-strategy/page.tsx` | REAL (multi-leg strategy builder) |
| `/markets` | `src/app/(trading)/markets/page.tsx` | REAL |
| `/portfolio` | `src/app/(trading)/portfolio/page.tsx` | REAL |
| `/perps` | `src/app/(trading)/perps/page.tsx` | REAL (perps kept fail-closed by backend) |

Every Options trading component is wired to real backend endpoints or
the lifecycle WebSocket; no placeholder / stub / mock data on the
critical trading path. Signal-level TODOs (Stop-Limit disabled stub;
`BACKEND_ENDPOINT_PENDING` fallback for public intent creation) are
non-blocking tech debt classified in the audit — the fallback UX is
honest ("paste intent id" for legacy execution-intent flow).

## Part B — API contract alignment

Frontend types synchronized to backend HEAD `50df42e`.

Change applied to `src/lib/trading-types.ts`:

* `OptionOrderResponse.signature?: Hex | null` →
  `signature_present: boolean` — the backend product-surface
  security review classified the raw EIP-712 signature as a HIGH
  finding on the unauthenticated public list route; the frontend
  now consumes the boolean witness only.
* `OptionOrderResponse.subaccount_id: number` added — required on
  every response since migration 0039.
* `OptionOrderResponse.terminal_reason_code / _message / _source`
  optional fields added — populated on terminal transitions
  (user cancel, IOC remainder, expired, post-only rejection).

No consumer breakage: the only reader of `OptionOrderResponse` in
non-request code (`DirectOrderbookForm.tsx`) uses `.status`,
`.remaining_size_1e8`, `.fills` — never `.signature`. Typecheck
+ 298 node contract tests + production build all green.

RFQ quote responses (`OptionRfqQuoteResponse`,
`OptionMultiLegRfqQuoteResponse`) retain `signature: string | null`
by design — the taker legitimately needs the maker's signature to
execute the accepted quote on-chain.

## Part C — subaccount integration

Frontend subaccount posture (SUBACCOUNTS-FRONTEND-SWITCHER-V1 +
SUBACCOUNTS-OPTIONS-ROUTING-V2):

* **Storage**: `localStorage` key `deopt.subaccount.<address>`
  (`src/lib/subaccount-storage.ts`). Also honors `?subaccount=N`
  URL query param (deep-link override). Defaults to subaccount 1
  matching backend v1-compat behavior.
* **Context**: `useWallet()` exposes `activeSubaccountId`,
  `subaccounts[]`, `setActiveSubaccountId()` (`src/lib/wallet.tsx`).
* **Selector**: `SubaccountSwitcher` renders next to the wallet
  button (`src/components/wallet/SubaccountSwitcher.tsx`) with
  create/rename.
* **Threading**: every write path passes the active subaccount:
  `DirectOrderbookForm` (order submit), `RfqStrategyWorkspace`
  (RFQ create/accept/cancel), `HistoryShell` (history filter),
  lifecycle WS payloads (order/fill/conditional carry
  `subaccount_id` since `feat(subaccounts): thread subaccount ids
  into options ws payloads`).

Documented non-blocking limitations:

* Position/portfolio/balance endpoints do not accept a subaccount
  query at the backend HTTP layer; frontend filters client-side.
* Perps read routes are not subaccount-scoped (perps kept
  fail-closed by backend; UI shows honest disabled state).

## Part D — market / series selection

* `MarketSelector` (`src/components/trading/MarketSelector.tsx`)
  drives underlying + product selection via `useProducts()`.
* `OptionChain` (`src/components/trading/OptionChain.tsx`) drives
  strike + expiry selection via `useProductDetails()`.
* Selected series propagates through `SelectedOptionProvider`
  context to Orderbook, TradeTicket, QuotePreview, and PositionsTable.
* Loading / empty / stale states handled via shared UI primitives
  (`LoadingState`, `EmptyState`, `ErrorState` in `src/components/ui.tsx`).
* No hard-coded product IDs; every selectable product comes from
  `GET /options/products`.

## Part E — orderbook

`OrderbookPanel` (`src/components/trading/OrderbookPanel.tsx`) uses
`useOrderbook()` (5-second polling of
`GET /options/series/:id/details`). Bids / asks / last-fill / mark.
Deterministic order; loading skeleton; empty state; click-to-populate
the trade widget preserved. WS updates ride on the lifecycle channel;
REST snapshot re-fetches after each `onResync()` callback so
snapshot + delta converge on reconnect.

## Part F — trade widget

`DirectOrderbookForm` (`src/components/trading/DirectOrderbookForm.tsx`)
supports Buy / Sell, price + quantity, order type (Limit / Stop Limit /
TWAP — Stop Limit rendered as honest disabled stub), TIF (GTC / IOC /
FOK), post-only, and attached TP/SL. Backend validation errors
surface directly through the `TradingApiError` code + message.
Post-only + IOC / FOK invalid combos rejected server-side, error
message shown verbatim; the user's chosen TIF is never silently
mutated.

`TradeTicket` (`src/components/trading/TradeTicket.tsx`) drives the
execution-intent + signature flow: create intent → fetch signing
payload → wallet sign → post signatures. Falls back to
"paste intent ID" when public intent creation is not yet exposed
(`BACKEND_ENDPOINT_PENDING`).

## Part G — order preview / risk information

`QuotePreviewCard` (`src/components/trading/QuotePreviewCard.tsx`)
consumes `useQuotePreview()` (manual fetch on user input). Renders
side, quantity, limit price, estimated premium, collateral / risk
requirement, fee preview, active subaccount — all sourced from the
backend `/options/quotes/preview`. The frontend does not run a
second risk engine; if a field cannot be canonically obtained it is
omitted rather than fabricated. Backend remains authoritative.

## Part H — EIP-712 signing + submission

* **Domain**: `DeOptV2-OptionMatchingEngine` v1, Base Sepolia
  (`chain_id=84532`). Verifying contract from backend signing
  payload; dev fallback `0x0…0` (Anvil only; Base Sepolia hard-gates
  the real domain via `src/lib/chains.ts`).
* **Types**: `OPTION_TRADE_TYPES` / `OPTION_RFQ_TRADE_TYPES` in
  `src/lib/eip712.ts`.
* **Sign path**: `signTypedData` via viem `WalletClient.signTypedData()`;
  no auto-sign anywhere — every signature requires an explicit user
  click that triggers the wallet's approval prompt.
* **Write-auth envelope**: separate EIP-712 domain
  `DeOpt API Write v1` (frozen salt
  `keccak256("deopt-api-write:base-sepolia:v1")`) used for order /
  RFQ / conditional-order mutations. Canonical bytes built by
  `src/lib/write-auth.ts::buildAuthorization`.
* **Chain guard**: mainnet hard-blocked (`src/lib/chains.ts`
  refuses to default to mainnet without audit closure).
* **No raw sig persisted**: signatures live only in memory for the
  submission tx; nothing written to `localStorage` / `sessionStorage`.
* **Rejection handling**: wallet rejection surfaces as
  `TradingApiError` with a friendly message; network mismatch shown
  via `ErrorState` with chain hint.

## Part I — order success / failure UX

`DirectOrderbookForm` renders the actual backend response state
(never assumes `submitted == filled`). Status pill shows one of the
backend enum values: `open`, `partially_filled`, `filled`, `cancelled`,
`rejected`, `expired`. Terminal-reason chips render when
`terminal_reason_code` is present. Fills array from the
`SubmitOptionOrderResponse` is rendered as a live list (post-only
rejection = zero fills; IOC/FOK partial = fills + terminal state).

`canonical_order_hash` / `canonical_execution_id` are consumed only
when the backend surfaces them — never generated client-side.

## Part J — open orders

Open orders table (part of the workspace widget grid) reads from
the account order endpoint scoped to the active subaccount.
Cancellation goes through the write-auth envelope; ownership is
enforced server-side by the `resolve_options_v2_subaccount` guard.
On successful cancel the UI reconciles from the backend response
plus a lifecycle refresh.

## Part K — fills + pending settlement

`TradeHistoryTable` (`src/components/trading/TradeHistoryTable.tsx`)
renders recent fills sourced from `/options/series/:id/details`.
Fill rows carry `canonical_execution_id` when present. The
distinction between matched-with-pending-settlement and canonically
settled is exposed via the correlation status returned by the
history endpoint's `MatchedExecution` / `PremiumTransferred`
event families — pending appears as an in-flight indicator and
transitions to a settled marker once the canonical event lands.
Frontend never interprets a fill as an immediately-settled position.

## Part L — canonical positions

`PositionsTable` (`src/components/trading/PositionsTable.tsx`)
consumes `usePositions()` (30-second polling of
`GET /accounts/:address/positions`). Positions come exclusively
from canonical backend state — the frontend never derives a
settled position from client-side fill accumulation. Fields
rendered: instrument, side, quantity, entry price, mark price,
unrealized PnL (when backend supplies it), subaccount. No
fabricated Greeks / synthetic marks.

## Part M — history v2

`HistoryShell` (`src/components/history/HistoryShell.tsx`) drives
the tabbed history: Trades / Transactions / Orders / Conditional /
Settlement / Funding / Interest / Liquidations. Endpoint:
`GET /accounts/:address/history/v2`. Query params: `tab`, `range`
(last_day / week / month / quarter / all), `page`, `page_size`,
`subaccount_id` (from `activeSubaccountId`), `all` (wallet aggregate
opt-in). Terminal-reason logic combines `terminal_reason_code`,
`status`, and `order_type` to surface user-facing lifecycle
messages. Backend limitations documented as non-blocking:

* No dedicated `PendingSettlement` family — PENDING is observable
  through the `ReservationIncrease` + subsequent settlement events.
* IOC/FOK/post-only rejection bundled in `terminal: bool` flag.
* Block-range only (no timestamp range).

## Part N — WebSocket live state

`lifecycle-ws.ts` (`src/lib/lifecycle-ws.ts`) implements the public
WS lifecycle client:

* **URL**: `NEXT_PUBLIC_PUBLIC_WS_URL` or derived from
  `NEXT_PUBLIC_TRADING_API_BASE_URL` (http → ws://, https → wss://).
* **Auth**: EIP-191 personal_sign of the backend challenge
  (`auth.challenge` → `auth.verify`).
* **Subscriptions**: `account.orders`, `account.fills`,
  `account.conditional_orders`, plus `account.rfqs` when
  `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=true`.
* **Reconnect**: exponential backoff 1s → 30s max. On re-subscribe
  success, `onResync()` fires so the consumer refetches REST
  snapshots — REST snapshot + WS delta converge to consistent state.
* **Address binding**: session address is re-verified on reconnect;
  the backend rebind guard (Part M of the backend closure)
  clears prior subscriptions when identity changes.
* **Subaccount filtering**: lifecycle payloads carry `subaccount_id`
  (SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1); the frontend filters
  client-side to the active subaccount view.

## Part O — failure states

Handled by `ErrorState` component (`src/components/ui.tsx`) with
context-aware hints. Covered scenarios: no wallet, wrong chain,
disconnected wallet, wallet change, account change, subaccount
change, backend unavailable, WS unavailable + REST available, REST
unavailable, stale product, insufficient collateral, signing
rejection. Chain guard rejects Base mainnet (only 84532 accepted).

## Part P — RFQ / strategy boundary

Multi-leg RFQ shipped in `feat(rfq): add multi-leg frontend flow`
(`RfqStrategyWorkspace.tsx`) with full lifecycle: create → quotes
list → accept with signature → cancel. Both single-leg and
multi-leg RFQ carry `subaccount_id`. TTL semantics respected
(backend-authoritative; frontend does not weaken caps). Fill status
uses backend correlation state. `NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED`
build-time flag; backend `OPTION_RFQ_MULTI_LEG_ENABLED` is
authoritative and returns 503 if disabled — UI surfaces honest
"disabled" message.

## Part Q — visual / UX consistency

Preserved: Derive-inspired density, workspace-grid layout, minimal
testnet messaging, component name `trade` (not `trade-detail`),
no giant explanatory cards. Empty / loading / error states use
shared UI primitives with consistent iconography. Trade form
alignment, orderbook readability, subaccount visibility all
verified at desktop + common laptop viewports.

## Part R — test matrix

Existing tests already cover the mandated 25 scenarios:

* **Node contract tests (298 pass)** in `tests/node/*.mjs`:
  execution-mode, history-conditional, history-reasons,
  lifecycle-parse, options-rfq-canonical + flag +
  lifecycle-parse, options-twap-canonical, orderbook-client,
  perps-subaccounts-frontend-routing, price-scaling,
  rfq-multi-leg-flag, rfq-strategy-payoff, subaccount-storage,
  subaccounts-canonical, subaccounts-options-ws-payload,
  subaccounts-rfq-canonical / multi-leg-canonical,
  underlying-symbols, write-auth-canonical, attached-tp-sl-payload,
  bug-report-context, faucet-reserve-monitor,
  perps-ticket-enablement-flag, perps-v2-write-auth-canonical.
* **Playwright E2E specs (72 files)** in `tests/e2e/*.spec.ts`:
  cover load product, switch product, load orderbook, click
  orderbook price, GTC / IOC / FOK submit, post-only, invalid
  combos, wallet signing reject, insufficient collateral,
  successful resting, partial fill, pending settlement,
  canonical settlement, cancel, subaccount switch,
  same-wallet-different-subaccount, history pagination, canonical
  position rendering, WS update, WS reconnect, wallet switch,
  backend error, wrong chain, RFQ single + multi-leg lifecycle,
  attached TP/SL, TWAP orders, terminal-reason surfacing.

## Part S — backend contract smoke

Node contract tests validate every wire-shape frontend expects
against the actual serialized backend types. 298/298 pass. Schema
drift between backend HEAD `50df42e` and the frontend is caught by:

* `subaccounts-options-ws-payload.contract.mjs` — WS payload
  structure incl. buyer/seller subaccount fields on fills.
* `history-reasons.contract.mjs` — terminal-reason code
  enumeration.
* `write-auth-canonical.contract.mjs` — canonical byte encoding.
* `subaccounts-canonical.contract.mjs` + `subaccounts-rfq-canonical.mjs`
  — subaccount-aware canonical write-auth bytes.
* `options-rfq-canonical.contract.mjs` +
  `subaccounts-rfq-multi-leg-canonical.mjs` — RFQ single + multi-leg
  canonical bytes.
* `price-scaling.contract.mjs` — u128 × 1e8 handling.
* `orderbook-client.contract.mjs` — REST envelope + fields.

## Part T — runtime performance

Polling intervals conservative: products 60s, series details 5s,
positions/portfolio/balances 30s, health 30s. Manual-fetch hooks
(preview / intent) don't poll. Orderbook renders don't full-page
rerender on every WS tick (React state per-widget). WS reconnect
uses exponential backoff (1s → 30s cap). No duplicate subscriptions
observed (single instance per session). Unbounded retained events
mitigated by REST refetch + slice on `onResync()`.

## Part U — security

* **No auto-sign**: every wallet signature originates from an
  explicit user click.
* **No raw signature persistence**: signatures never written to
  `localStorage` / `sessionStorage`; only sent in the submit
  network request and dropped from memory.
* **Chain guard**: mainnet hard-blocked via `src/lib/chains.ts`;
  wrong-chain surfaces `ErrorState` with switch-chain hint.
* **Subaccount not spoofable client-side**: mutation routes verify
  `(owner, subaccount_id)` server-side via
  `resolve_options_v2_subaccount`; frontend is not treated as
  authorization authority.
* **Backend error rendering**: envelope + raw error shapes both
  parsed via `TradingApiError`; codes rendered as sanitized hints
  (no HTML injection surface).
* **Stale WS subscription state**: cleared on wallet change and on
  backend session rebind (Part M of the backend closure).
* **Perps fail-closed**: UI surfaces backend's `trading_enabled: false`;
  no live perps trading path.

## Part V — build / regression

* `npm run typecheck` — clean.
* `npm run lint` — 0 errors, 1 pre-existing unused-var warning
  in `tests/e2e/rfq-strategy-foundation-v1.spec.ts:70`.
* `npm run test:node` — **298/298 pass** (`541.35ms`).
* `npm run build` — production build succeeds; all routes render
  (`/options`, `/trade`, `/history`, `/rfq-strategy`, `/markets`,
  `/portfolio`, `/perps`, `/health`, `/leaderboard`, `/fees`,
  `/fundings`, `/settings`, `/feedback`, `/docs`, `/custom`,
  `/api/orderbook-sandbox`, `/api/sandbox`,
  `/markets/[productId]`, `/transactions/[requestId]`).

## Part W — documentation

* `docs/OPTIONS_FRONTEND_TRADING_INTEGRATION_V1.md` — this doc.
* `~/DEOPT/docs/OPTIONS_FRONTEND_TRADING_INTEGRATION_V1_RESULT.md`
  — result summary.
* `~/DEOPT/RUN_STATE.md` — appended.

## Non-blocking tech debt

* Stop-Limit order type rendered as honest disabled stub — backend
  does not yet ship a standalone stop-limit product.
* Public intent-creation endpoint pending — `TradeTicket` falls
  back to paste-intent-id flow when the backend returns
  `BACKEND_ENDPOINT_PENDING`.
* Position / portfolio / balance endpoints don't accept
  subaccount query param at the backend HTTP layer; frontend
  filters client-side. Backend Part D of the final closure
  documents this as a non-blocking limitation.
* One eslint warning in a test spec file (unused `legs` var).

## Files touched

* `src/lib/trading-types.ts` — `OptionOrderResponse` aligned to
  backend HEAD `50df42e` (add `subaccount_id`, replace `signature`
  with `signature_present`, add `terminal_reason_*` fields).

That's the only source change required. Every other Options
trading surface was already wired to the real backend via prior
milestones — this milestone is the honest validation + final
alignment.

## Safety

- No real chain transaction sent.
- No new frontend key custody.
- Base mainnet chain ID `8453` hard-blocked (`src/lib/chains.ts`).
- Backend + Solidity untouched.
- No fabricated PnL / Greeks / balances / fills / settlement status.
