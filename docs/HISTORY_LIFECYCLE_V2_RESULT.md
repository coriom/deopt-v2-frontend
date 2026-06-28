# HISTORY-LIFECYCLE-V2 — result

Sister milestone: **OPTIONS-ROUTE-RENAMING-V1** (renames `/trade` to
`/options` with a server-side redirect for backwards compatibility) is
documented in the same session and noted in `RUN_STATE.md`.

This document covers the upgrade of `/history` to surface real
conditional-order (TP/SL) activity, link rows to their child orders,
expose failure codes, and refresh on lifecycle deltas.

---

## OPTIONS-ROUTE-RENAMING-V1 — summary

**Canonical route:** `/options`
**Redirect:** `/trade → /options` (server-side 307 via `redirect()`
from `next/navigation` in `src/app/(trading)/trade/page.tsx`)
**Visible label:** `Options` (unchanged from prior IA)

Updated references:

* `src/app/(trading)/layout.tsx` — navbar `Options` link points at `/options`.
* `src/components/HamburgerMenu.tsx` — hamburger `Options` entry points at `/options`.
* `src/components/TradingShell.tsx` — `/options` added to the terminal-style routes; `/trade` left in the list for the redirect-intermediate moment.
* `src/components/landing/CosmicLanding.tsx` — all 3 `Launch the terminal` / `Open options terminal` CTAs point at `/options`.
* `src/components/fundings/FundingsShell.tsx` — `Options` action button on funding rows points at `/options?underlying=…`.
* Playwright suite — every `/trade` `page.goto` / `href` assertion migrated to `/options`; one new test (`legacy /trade URL still resolves`) keeps `/trade` exercised so the redirect can never silently regress.

**Internal-symbol cleanup deferred** per the brief's "if risky, leave
internal component names unchanged and document deferred internal
cleanup" clause. Deferred to a future milestone (no user-facing impact):

* `TradeTicketPanel` component name + `data-testid="trade-*"` prefix.
* Workspace registry `"trade"` widget type id (serialised into
  `localStorage`-backed workspace state; renaming would invalidate the
  layout key for every existing user).
* `data-trade-mode`, `data-trade-side` DOM attributes on the ticket.

**Hard acceptance criteria — met:**

| criterion | state |
|---|---|
| `/options` is canonical | yes (renders the Options workspace) |
| `/trade` does not 404 | yes (307 redirect to `/options`) |
| Nav uses label `Options` pointing at `/options` | yes (navbar + hamburger) |
| Build, lint, typecheck, node tests green | yes |

---

## HISTORY-LIFECYCLE-V2 — summary

`/history` keeps its V1 7-tab IA (Trades / Transactions / Orders /
Settlement / Funding / Interest / Liquidations) and now ALSO carries:

* A new **TP/SL** tab backed by `GET /accounts/:address/conditional-orders`.
* A **lifecycle status badge** (re-used from
  `FRONTEND-LIFECYCLE-OBSERVABILITY-V1`) so the operator can see at a
  glance whether the private WS is live.
* A **refresh banner** that appears whenever a lifecycle delta is
  received on `account.orders`, `account.fills`, or
  `account.conditional_orders` while the user is on `/history`.
  Clicking the banner bumps a refresh nonce that re-runs the current
  tab's fetch.
* A **manual refresh button** for when the user just wants to refetch
  without waiting for a lifecycle delta.
* On WS reconnect (`resyncToken` increment from `useLifecycleStream`),
  the page silently refetches and clears any pending banner.

### Tabs (post-V2)

| id | label | source | notes |
|---|---|---|---|
| `trades` | Trades | `GET /accounts/:address/history/v2?tab=trades` | unchanged |
| `transactions` | Transactions | `…/v2?tab=transactions` | unchanged |
| `orders` | Orders | `…/v2?tab=orders` | unchanged |
| `conditional` | **TP / SL** | `GET /accounts/:address/conditional-orders` | new |
| `settlement` | Settlement | `…/v2?tab=settlement` (empty placeholder) | unchanged |
| `funding` | Funding | `…/v2?tab=funding` (empty placeholder) | unchanged |
| `interest` | Interest | `…/v2?tab=interest` (empty placeholder) | unchanged |
| `liquidations` | Liquidations | `…/v2?tab=liquidations` (empty placeholder) | unchanged |

### Conditional / TP-SL columns

`Time · Instrument · Side · Trigger · Trigger Price (1e8) · Size (1e8)
· Status · Child Order · OCO Group · Failure`

* Time uses `updated_at_ms` (so triggered/cancelled rows bubble to the top).
* `Status` is colour-coded:
  * `armed` / `pending` → emerald (active).
  * `triggered` / `completed` → muted zinc (terminal but not a failure).
  * `cancelled` → muted zinc (terminal, neutral).
  * `failed` / `expired` → red (terminal, attention-worthy).
* `Child Order` and `OCO Group` are shortened to `6…4` with the full
  id available in the `title` attribute. No copy button — keeping
  parity with the existing `/history` chrome (no copy helpers exist
  anywhere else on the page).
* `Failure` renders the `failure_code` in red with `failure_message`
  in the `title` so the user can hover to see the worker's full
  message; empty string when no failure.

### Live-mode strategy — refresh banner (not delta merge)

The brief explicitly sanctioned the refresh-banner pattern as an
acceptable alternative to silent delta merging — and that's what we
shipped, because:

* `/history` is **paginated**. Inserting a freshly-arrived row into the
  middle of page 2 would visually shuffle the layout while the user is
  reading, and mid-page injection is the most confusing UX possible
  with a paginated table.
* The user has a `range` filter active. A delta that arrives outside
  the visible range would either silently vanish (bad) or force a
  range-filter override (worse).
* The banner is honest: "New activity available — refresh to see the
  latest rows." One click → refetch.

WS reconnect (`resyncToken` bump from the lifecycle hook) **does**
trigger an automatic refetch, because we know we may have missed
events while disconnected and the silent refresh is the user-friendly
behavior there.

### Conditional tab fetch / slice strategy

* **Network shape**: full-snapshot `GET /accounts/:address/conditional-orders`.
* **Pagination**: client-side via `sliceConditionalHistory` (sorts by
  `updated_at_ms` desc, applies the active range filter, then slices
  by `page` × `pageSize`).
* **Range cutoff anchor**: captured at fetch time (`fetchedAtMs`) so
  the render pass stays pure — `Date.now()` is forbidden inside
  `useMemo` by the `react-hooks/purity` lint rule and would also make
  the displayed window drift mid-render. The cutoff freezes per fetch;
  clicking the refresh button picks up a fresh anchor.

### Files added

* `src/lib/history-conditional.ts` — pure helpers
  (`isTerminalConditionalStatus`, `rangeSinceMs`,
  `sliceConditionalHistory`, `shortId`). React-free so node tests can
  cover them end-to-end.
* `tests/node/history-conditional.contract.mjs` — 10 node tests
  re-implementing the helpers in pure JS and asserting parity.
* `tests/e2e/history-lifecycle-v2.spec.ts` — 6 Playwright tests
  covering TP/SL tab presence, disconnected state, armed-row render,
  failed-row failure-code surface, child-order shortening, and the
  manual refresh button.
* `src/app/(trading)/options/page.tsx` — canonical `/options` route
  (mounts the same Options workspace as the old `/trade` page).

### Files modified

* `src/components/history/HistoryShell.tsx` — adds TP/SL tab,
  branch-fetches conditional data via `listConditionalOrders`,
  subscribes to lifecycle channels, renders the lifecycle status
  badge + refresh banner + manual refresh button, and surfaces
  failure codes / child-order shortening in the new column set.
* `src/app/(trading)/trade/page.tsx` — now a server-side
  `redirect("/options")` shim.
* `src/app/(trading)/layout.tsx`, `src/components/HamburgerMenu.tsx`,
  `src/components/TradingShell.tsx`, `src/components/landing/CosmicLanding.tsx`,
  `src/components/fundings/FundingsShell.tsx` — nav / CTA hrefs
  pointed at `/options`.
* 11 Playwright spec files — `/trade` → `/options` everywhere, with
  one deliberate `/trade` test kept (`legacy /trade URL still
  resolves`) as the regression anchor for the redirect.

### Backend changes

**None.** No backend file was touched. The new TP/SL tab uses an
existing endpoint (`GET /accounts/:address/conditional-orders`), and
the existing `/history/v2` endpoint is unchanged. No migration, no
schema change, no semantic change.

### Tests

* **Frontend node tests:** 35/35 (was 25/25 pre-V2; +10 conditional helpers).
* **Frontend lint:** clean.
* **Frontend typecheck:** clean.
* **Frontend production build:** clean — both `/options` and `/trade`
  appear in the route list (the second as a redirect).
* **Playwright `--list`:** 285 tests in 44 files (was 278 in 43 files
  pre-this-session; +1 route compatibility, +6 history-lifecycle-v2,
  net +7).
* **Backend:** untouched, no validation needed.

### Hard acceptance criteria

| criterion | state |
|---|---|
| `/options` is canonical | yes |
| `/trade` does not break existing links | yes (server-side redirect; explicit Playwright anchor) |
| Navigation uses `Options` | yes |
| `/history` shows real orders + fills + conditional where data exists | yes (Orders/Trades tabs unchanged + new TP/SL tab) |
| Child order / fill linkage where data exists | yes (TP/SL row shows `child_order_id` shortened with full id in title) |
| Cancel / failure reasons where data exists | yes (TP/SL row shows `failure_code` in red with full message in title) |
| Optional live mode safely or deferred with refresh banner | refresh banner shipped (delta-merge deferred — see Limitations) |
| No fake rows | yes |
| No perps lifecycle presented as live | yes (perps is still a separate `/perps` route with its own coming-soon state) |
| Build / lint / typecheck / node tests green | yes |
| No secret exposure | yes (no `.env`, RPC URL, DB URL, signature, nonce, bearer logged or rendered) |
| No chain transaction | yes |
| No deployment | yes |
| No mainnet | yes |
| No Solidity change | yes |

### Limitations / honest gaps

* **Lifecycle WS auth under Playwright is currently unverified.** The
  mock wallet fixture handles `eth_signTypedData_v4` but not
  `personal_sign`. The page degrades gracefully (the REST tabs work
  fine; the status badge shows the WS failure), but a full E2E proof
  of the live-mode WS → refresh-banner path requires extending the
  mock wallet. Deferred to `FRONTEND-LIFECYCLE-OBSERVABILITY-E2E-V1`
  (already on the deferred list from the V1 milestone).
* **Trades / Orders tabs do not surface a `failure_code` column.** The
  backend's `HistoryV2Item` shape carries `status` but not
  `failure_code` or `cancel_reason` for those tabs. Adding it would
  be a backend schema + serializer change; deferred to
  `HISTORY-V2-FAILURE-REASONS-V1`.
* **Conditional tab fetches the entire conditional-order list** for
  the address on every load and paginates client-side. With a small
  account this is a non-event; an account with thousands of
  conditionals would benefit from server-side pagination. Deferred to
  `HISTORY-V2-CONDITIONAL-PAGINATION-V1`.
* **No advanced filters (status, series id, type) in the TP/SL tab.**
  The brief listed these as nice-to-haves ("if easy"). Range filter
  works; status / series-id filters deferred to
  `HISTORY-V2-FILTERS-V1`.
* **No CSV export-only-this-page mode.** The existing CSV export
  exports the visible page; for the conditional tab, it exports the
  currently-visible page after range + pagination. No regression.

### Deferred follow-ups (for the next planning slot)

* `FRONTEND-LIFECYCLE-OBSERVABILITY-E2E-V1` — extend mock wallet with
  `personal_sign` and add a full WS handshake → banner → refresh E2E.
* `HISTORY-V2-FAILURE-REASONS-V1` — surface `failure_code` /
  `cancel_reason` for Orders / Trades tabs.
* `HISTORY-V2-CONDITIONAL-PAGINATION-V1` — server-side pagination for
  the conditional tab if any account ever crosses ~1k rows.
* `HISTORY-V2-FILTERS-V1` — status + series-id filters across tabs.
* `OPTIONS-ROUTE-INTERNAL-RENAME-V1` — rename `TradeTicketPanel`,
  workspace `"trade"` widget type, `data-trade-*` DOM attributes once
  workspace migration semantics are agreed.
* `ORDER-LIFECYCLE-OBSERVABILITY-WORKER-PG-PROOF-V1` — PostgreSQL
  proof for the worker lifecycle emission paths (already in the
  deferred list from `ORDER-LIFECYCLE-OBSERVABILITY-WORKER-V1`).
* `ACCOUNT-WRITE-AUTH-HARDENING-PERPS-V1` — perp routes are currently
  fail-closed; full EIP-712 wire-up deferred until perps go live.

### Recommendation

Two natural next moves:

1. **Operator-trust path** — `FRONTEND-LIFECYCLE-OBSERVABILITY-E2E-V1`
   so the live banner path is provably green in CI before we promise
   "real-time" to anyone external.
2. **Observability finish** — `HISTORY-V2-FAILURE-REASONS-V1` so the
   reason a user's order was cancelled / rejected is visible on the
   Orders tab too (today they have to click into TP/SL to find a
   failure_code, but a directly-submitted limit order's cancel reason
   isn't surfaced anywhere in the UI).

Either is small. The first removes a known E2E gap; the second
removes a known operator-visible information gap.
