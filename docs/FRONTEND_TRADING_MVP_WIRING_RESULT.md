# FRONTEND-TRADING-MVP-WIRING — Result (M-P3)

**Date:** 2026-06-10
**Stack:** Next.js 16.1.6 (Turbopack) + React 19.2.3 + TypeScript 5 + Tailwind 4
**Posture:** **testnet beta; NOT YET AUDITED**. Mainnet trading is hard-gated
in code (`isMainnetEnabled() === false`).
**Status:** trading MVP wired against the M-P2/M-P2a OpenAPI surface +
backend; `npx tsc --noEmit` + `eslint` + `next build` all clean.

## 1. Scope

This milestone (M-P3) wires the DeOpt V2 trading MVP frontend against:
- `~/DEOPT/deopt-v2-backend/docs/openapi/trading-api.openapi.json` (M-P2 spec)
- `~/DEOPT/deopt-v2-backend/src/api/trading.rs` (M-P2a backend handlers)
- `~/DEOPT/deopt-v2-sol/abis/freeze-v2-product-rc1/` (frozen sol ABI; for typed-data envelope shape in M-P3b)

The result: 8 new app routes + 1 trading layout + 14 components + 14 hooks + 5 lib modules + `.env.example` + 3 docs.

## 2. Architecture

```
src/
├── app/
│   ├── (trading)/                ← M-P3 route group (uses WalletProvider + banners)
│   │   ├── layout.tsx
│   │   ├── page.tsx               → "/"
│   │   ├── markets/
│   │   │   ├── page.tsx           → "/markets"
│   │   │   └── [productId]/page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── history/page.tsx
│   │   ├── transactions/[requestId]/page.tsx
│   │   └── health/page.tsx
│   ├── admin/                     ← UNCHANGED (admin scope)
│   ├── layout.tsx                 ← UNCHANGED root layout
│   └── globals.css                ← UNCHANGED
│
├── components/
│   ├── ui.tsx                     LoadingState / EmptyState / ErrorState / StaleDataBadge
│   ├── banners.tsx                TestnetUnauditedBanner / NetworkBadge / MainnetDisabledBanner
│   ├── wallet/
│   │   └── WalletConnectButton.tsx
│   ├── trading/
│   │   ├── MarketSelector.tsx
│   │   ├── OptionChain.tsx
│   │   ├── CallPutToggle.tsx
│   │   ├── StrikeExpirySelector.tsx
│   │   ├── OrderbookPanel.tsx
│   │   ├── RfqPanel.tsx
│   │   ├── TradeTicket.tsx
│   │   ├── QuotePreviewCard.tsx
│   │   ├── PositionsTable.tsx
│   │   ├── PortfolioSummary.tsx
│   │   ├── BalancesCard.tsx
│   │   ├── TradeHistoryTable.tsx
│   │   └── TradingHealthCard.tsx
│   └── tx/
│       └── TxStatusTimeline.tsx
│
├── hooks/
│   └── trading.ts                 14 hooks (useProducts / useProductDetails / useProductBatch /
│                                  useSeriesDetails / useOrderbook / useQuotePreview / usePositions /
│                                  usePortfolio / useBalances / useTradeHistory / useTxStatus /
│                                  useExercisePreview / useClosePreview / useTradingHealth)
│
├── lib/
│   ├── trading-types.ts           hand-derived from OpenAPI; matches `0.1.0-mvp`
│   ├── trading-api.ts             fetch client (NO admin Bearer)
│   ├── chains.ts                  ANVIL / BASE_SEPOLIA / BASE_MAINNET; mainnet GATED
│   ├── wallet.tsx                 WalletProvider context (EIP-1193; raw)
│   └── eip712.ts                  typed-data envelope STUB; isSigningEnabled()===false
```

## 3. Dependencies added

**None added to runtime deps** in this milestone. The package.json edits are:
- `scripts.dev:mock-backend` — convenience hint for running `prism mock` against the OpenAPI spec.
- `scripts.typecheck` — `tsc --noEmit`.

Wallet integration uses **raw EIP-1193** (`window.ethereum`) — no viem / wagmi / @web3modal added. Rationale:
- M-P3 does NO signing, NO broadcast, NO transaction send (per the brief's "No real transaction send in this milestone").
- Without signing, viem's typed-data + signing helpers aren't needed yet.
- Wallet detect + read `chainId` + `accounts` is sufficient via raw EIP-1193.
- viem/wagmi are added when signing wires in **M-P3b** (next milestone), against the backend-issued envelope at `/options/execution-intents/:id/signing-payload`.

## 4. Routes

| Route | Page | Notes |
|---|---|---|
| `/` | `app/(trading)/page.tsx` | landing with MarketSelector |
| `/markets` | `markets/page.tsx` | products list |
| `/markets/:productId` | `markets/[productId]/page.tsx` | option chain + RFQ stub |
| `/portfolio` | `portfolio/page.tsx` | summary + positions + balances |
| `/history` | `history/page.tsx` | per-account fill history |
| `/transactions/:requestId` | `transactions/[requestId]/page.tsx` | tx status timeline (stub for M-P3b) |
| `/health` | `health/page.tsx` | trading health card |
| `/admin` | (unchanged) | admin scope; separate; no trading-route leakage |
| `/_not-found` | (default) | Next 404 |

**8 trading routes + 1 admin route** in production build (`next build` reports `Compiled successfully`).

## 5. Hooks

All hooks return `{ data, error, isLoading, refetch }`. Polling intervals per `FRONTEND_TRADING_API_HANDOFF.md §6`:

| Hook | Refetch interval |
|---|---|
| `useProducts`, `useProductDetails`, `useProductBatch` | 60 s |
| `useSeriesDetails`, `useOrderbook` | 5 s |
| `useQuotePreview`, `useExercisePreview`, `useClosePreview` | 0 (input-driven) |
| `usePositions`, `usePortfolio`, `useBalances` | 30 s |
| `useTradeHistory` | 0 (paginated) |
| `useTxStatus` | placeholder for M-P3b |
| `useTradingHealth` | 60 s |

## 6. Wallet / network

- `WalletProvider` (`src/lib/wallet.tsx`) wraps the trading route group.
- Raw EIP-1193 detection; injected provider only.
- `chainId` + `accountsChanged` event subscription.
- **Mainnet hard-gate**: `BASE_MAINNET.isMainnetGated = true`, `isMainnetEnabled() === false`. When a user connects on mainnet, the `MainnetDisabledBanner` shows red across the top and the Trade button is disabled regardless of any other state.
- Default expected chain: Base Sepolia (84532). Override via `NEXT_PUBLIC_CHAIN_ENV=anvil|sepolia`.
- **Mainnet env value is silently downgraded to Sepolia** in `expectedChainId()` — defence-in-depth.

## 7. UX states implemented

| State | Source | Component |
|---|---|---|
| loading | hook `isLoading` | `LoadingState` |
| empty | hook `data.length === 0` | `EmptyState` |
| error generic | hook `error` | `ErrorState` (red) |
| error SOURCE_UNAVAILABLE | hook `error.code === "SOURCE_UNAVAILABLE"` | `ErrorState` (amber) |
| stale data | `data.meta.freshness_ms` | `StaleDataBadge` (30 s threshold) |
| wallet disconnected | `useWallet().address === null` | `WalletConnectButton`, `EmptyState` |
| wallet no provider | `useWallet().hasProvider === false` | "Install a wallet" CTA |
| wrong network | `useWallet().isExpectedChain === false` | `NetworkBadge` (amber) |
| mainnet detected | `useWallet().isMainnet === true` | `MainnetDisabledBanner` (red, sticky) |
| testnet beta | always | `TestnetUnauditedBanner` (amber, sticky) |
| signing disabled | `isSigningEnabled() === false` | `TradeTicket` Sign button disabled with explanation tooltip |

## 8. Banners enforced

- **`TestnetUnauditedBanner`** — sticky top, every trading route. Reads: "⚠ Testnet beta — NOT YET AUDITED. Do NOT deposit real funds. Mainnet trading is disabled."
- **`MainnetDisabledBanner`** — sticky below, only when `isMainnet === true`. Reads: "❌ Mainnet detected — Trading on Base mainnet (chain 8453) is DISABLED until external audit completes (post-M-P7). Switch to Base Sepolia (testnet) to continue."

These banners CANNOT be dismissed in M-P3. Removal requires M-P7 closure + external audit completion.

## 9. Mock API setup

Document `TRADING_UI_MOCK_API_RUNBOOK.md` describes:

```bash
# Terminal A — Prism mock backend (port 4010)
cd ~/DEOPT
npx @stoplight/prism mock deopt-v2-backend/docs/openapi/trading-api.openapi.json --port 4010

# Terminal B — frontend pointed at mock
cd deopt-v2-frontend
NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:4010 npm run dev
```

Alternatively, point at the real M-P2a backend (port 3000 default):

```bash
NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:3000 npm run dev
```

## 10. Validations

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean (exit 0) |
| `npx eslint src/` | clean (exit 0) — after fixing 2 React-19 strict rules (set-state-in-effect, refs-in-render) |
| `npx next build` | clean — Compiled successfully in 2.4 s; 9 routes generated (8 static, 1 dynamic group); Turbopack |
| `git diff --check` | clean |
| `git status` | new tree (`(trading)` group + lib + hooks + components + docs + `.env.example`) + `package.json` edit + deleted `src/app/page.tsx` (was the old Next template landing — replaced by `(trading)/page.tsx`) |
| Sensitive-string scan | no production EVM addresses; no real RPC URLs; no admin Bearer tokens; no DATABASE_URL; `.env.example` uses placeholders only |

## 11. Files changed

### New files

| Path | Purpose |
|---|---|
| `src/lib/trading-types.ts` | OpenAPI-derived TS types |
| `src/lib/trading-api.ts` | fetch client (NO admin Bearer) |
| `src/lib/chains.ts` | chain metadata; mainnet GATED |
| `src/lib/wallet.tsx` | WalletProvider + useWallet |
| `src/lib/eip712.ts` | placeholder typed-data stub |
| `src/hooks/trading.ts` | 14 trading hooks |
| `src/components/ui.tsx` | LoadingState / EmptyState / ErrorState / StaleDataBadge |
| `src/components/banners.tsx` | TestnetUnauditedBanner / NetworkBadge / MainnetDisabledBanner |
| `src/components/wallet/WalletConnectButton.tsx` | wallet button |
| `src/components/trading/MarketSelector.tsx` | products list grouped by underlying |
| `src/components/trading/OptionChain.tsx` | strike selector + trade ticket layout |
| `src/components/trading/CallPutToggle.tsx` | toggle |
| `src/components/trading/StrikeExpirySelector.tsx` | per-strike grid |
| `src/components/trading/OrderbookPanel.tsx` | best bid/ask card |
| `src/components/trading/RfqPanel.tsx` | RFQ stub for M-P3b |
| `src/components/trading/TradeTicket.tsx` | trade form + QuotePreview |
| `src/components/trading/QuotePreviewCard.tsx` | premium / fees / IM impact card |
| `src/components/trading/PositionsTable.tsx` | per-account positions |
| `src/components/trading/PortfolioSummary.tsx` | equity / IM / MM / free coll |
| `src/components/trading/BalancesCard.tsx` | per-token balances |
| `src/components/trading/TradeHistoryTable.tsx` | fill history |
| `src/components/trading/TradingHealthCard.tsx` | health card |
| `src/components/tx/TxStatusTimeline.tsx` | placeholder for M-P3b |
| `src/app/(trading)/layout.tsx` | trading route group layout + WalletProvider + banners + nav |
| `src/app/(trading)/page.tsx` | "/" landing |
| `src/app/(trading)/markets/page.tsx` | "/markets" |
| `src/app/(trading)/markets/[productId]/page.tsx` | "/markets/:productId" |
| `src/app/(trading)/portfolio/page.tsx` | "/portfolio" |
| `src/app/(trading)/history/page.tsx` | "/history" |
| `src/app/(trading)/transactions/[requestId]/page.tsx` | "/transactions/:requestId" |
| `src/app/(trading)/health/page.tsx` | "/health" |
| `.env.example` | env template (NO secrets) |
| `docs/FRONTEND_TRADING_MVP_WIRING_RESULT.md` | this doc |
| `docs/TRADING_UI_ROUTE_MAP.md` | route map |
| `docs/TRADING_UI_MOCK_API_RUNBOOK.md` | mock API runbook |
| `docs/E2E_LOCAL_TRADING_LIFECYCLE_NEXT_TASK.md` | M-P4 next-task prompt |

### Edited / removed

| Path | Change |
|---|---|
| `package.json` | added `dev:mock-backend` + `typecheck` scripts; no runtime deps added |
| `src/app/page.tsx` | **removed** — was the old Next template landing; replaced by `(trading)/page.tsx` at the same `/` URL |
| `src/app/admin/**` | UNCHANGED |
| `src/app/layout.tsx` | UNCHANGED root layout |

**No admin Bearer token in trading UI.** `src/lib/trading-api.ts` never sets `Authorization` header. The admin API client at `src/lib/admin-api.ts` remains the only consumer of admin scope.

## 12. Blockers

None for M-P3. Forward blockers (gated to M-P3b / M-P4):
- Signing flow + transaction submission lands in M-P3b (viem added then).
- Live RFQ + execution-intent posting lands in M-P3b.
- Live `useTxStatus` against `/options/execution-intents/:id` + `/executor/transactions/:intent_id` lands in M-P3b.
- Backend 6 deferred endpoints (`/options/quotes/preview`, `/accounts/:address/positions|portfolio|balances`, `/options/{exercise,close}/preview`) currently return `SOURCE_UNAVAILABLE`; UI shows graceful "not yet wired" placeholders.

## 13. Next milestone recommendation

**Serialised next:** `E2E-LOCAL-TRADING-LIFECYCLE` (M-P4) per `docs/E2E_LOCAL_TRADING_LIFECYCLE_NEXT_TASK.md`. Gated on:
- `BACKEND-TRADING-API-IMPLEMENTATION-PHASE-2` (M-P2b) → wires the 6 SOURCE_UNAVAILABLE endpoints
- `FRONTEND-TRADING-SIGNING` (M-P3b) → wires viem + EIP-712 signing + intent submit + live tx status

**In parallel** (independent of M-P3):
- M-P2b (backend) — RPC orchestration for 6 deferred endpoints.
- M-P3b (frontend) — wallet signing + intent submission + live tx status.

## 14. Cross-links

- `~/DEOPT/deopt-v2-backend/docs/BACKEND_TRADING_API_CONSOLIDATION_RESULT.md`
- `~/DEOPT/deopt-v2-backend/docs/BACKEND_TRADING_API_IMPLEMENTATION_RESULT.md`
- `~/DEOPT/deopt-v2-backend/docs/openapi/trading-api.openapi.json`
- `~/DEOPT/deopt-v2-backend/docs/FRONTEND_TRADING_API_HANDOFF.md`
- `~/DEOPT/deopt-v2-backend/docs/TRADING_INTERFACE_REQUIREMENTS.md`
- `~/DEOPT/deopt-v2-backend/docs/NEXT_PRODUCT_MILESTONES.md`
- `~/DEOPT/deopt-v2-sol/abis/freeze-v2-product-rc1/`
- `~/DEOPT/deopt-v2-sol/docs/SOL_BACKEND_FRONTEND_ABI_HANDOFF.md`

**End of M-P3 trading MVP wiring result.**
