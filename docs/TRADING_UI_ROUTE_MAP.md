# Trading UI Route Map (M-P3)

**Date:** 2026-06-10
**Frontend:** Next.js 16.1.6 App Router; route group `(trading)` shares
the WalletProvider + sticky banners.

## Route inventory

| URL | File | Page kind | Wallet required? | Backend endpoints consumed |
|---|---|---|---|---|
| `/` | `app/(trading)/page.tsx` | landing | no | `GET /options/products` |
| `/markets` | `app/(trading)/markets/page.tsx` | products list | no | `GET /options/products` |
| `/markets/:productId` | `app/(trading)/markets/[productId]/page.tsx` | option chain + trade ticket + RFQ stub | optional (trade button gated on wallet) | `GET /options/products/:product_id` + `GET /options/series/:series_id/details` + `GET /options/quotes/preview` (SOURCE_UNAVAILABLE) |
| `/portfolio` | `app/(trading)/portfolio/page.tsx` | summary + positions + balances | yes | `GET /accounts/:address/portfolio` (SU) + `/positions` (SU) + `/balances` (SU) |
| `/history` | `app/(trading)/history/page.tsx` | fill history | yes | `GET /accounts/:address/history` |
| `/transactions/:requestId` | `app/(trading)/transactions/[requestId]/page.tsx` | tx status timeline (stub) | no | placeholder for M-P3b: `GET /options/execution-intents/:id` + `/executor/transactions/:intent_id` |
| `/health` | `app/(trading)/health/page.tsx` | health card | no | `GET /trading/health` |
| `/admin` | `app/admin/page.tsx` | **admin dashboard (unchanged)** | n/a | admin Bearer scope; OUTSIDE trading route group |
| `/_not-found` | (default) | 404 | n/a | none |

## Layout map

```
app/
├── layout.tsx                 (RootLayout: <html>, <body>, globals.css)
│
├── (trading)/
│   └── layout.tsx             (TradingLayout: WalletProvider, banners, nav)
│       └── pages above
│
└── admin/
    └── page.tsx               (AdminDashboard; sessionStorage Bearer)
```

The admin route group is intentionally NOT inside `(trading)`. The
trading layout's `WalletProvider` does not wrap admin pages. The
admin's `sessionStorage["deopt.adminToken"]` Bearer is NEVER exposed to
trading routes.

## Component tree per route

### `/markets/:productId` (most complex)

```
app/(trading)/layout.tsx
├── TestnetUnauditedBanner (sticky)
├── MainnetDisabledBanner   (sticky if mainnet detected)
├── <header> WalletConnectButton + NetworkBadge
└── <main>
    └── markets/[productId]/page.tsx
        ├── OptionChain
        │   ├── CallPutToggle
        │   ├── StrikeExpirySelector
        │   └── TradeTicket
        │       ├── OrderbookPanel
        │       ├── side toggle + size + price inputs
        │       ├── QuotePreviewCard
        │       └── Sign button (disabled; M-P3b)
        └── RfqPanel (stub for M-P3b)
```

### `/portfolio`

```
app/(trading)/portfolio/page.tsx
├── PortfolioSummary
├── PositionsTable
└── BalancesCard
```

## Hook → endpoint mapping

| Hook | Endpoint | Polling |
|---|---|---|
| useProducts | `GET /options/products` | 60 s |
| useProductDetails | `GET /options/products/:product_id` | 60 s |
| useProductBatch | `GET /options/products/batch` | 60 s |
| useSeriesDetails / useOrderbook | `GET /options/series/:series_id/details` | 5 s |
| useQuotePreview | `GET /options/quotes/preview` | input-driven |
| usePositions | `GET /accounts/:address/positions` | 30 s |
| usePortfolio | `GET /accounts/:address/portfolio` | 30 s |
| useBalances | `GET /accounts/:address/balances` | 30 s |
| useTradeHistory | `GET /accounts/:address/history` | 0 (paginated) |
| useExercisePreview | `POST /options/exercise/preview` | input-driven |
| useClosePreview | `POST /options/close/preview` | input-driven |
| useTradingHealth | `GET /trading/health` | 60 s |
| useTxStatus | (stub for M-P3b) | n/a |

## Auth boundary

- Trading routes: **NO auth header**.
- Admin route: SSR proxy gate planned (V2G-W3); current uses `sessionStorage` Bearer.
- **The trading-api client is a fresh module (`src/lib/trading-api.ts`); it never imports `admin-api.ts` and never reads the admin Bearer.**

## Sensitive-string guard

The following MUST stay out of trading routes / components / hooks / lib:
- `EXECUTOR_PRIVATE_KEY`
- `DATABASE_URL`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- KMS key UUIDs / ARNs
- production EVM addresses (signer / executor / deployer)
- `sessionStorage["deopt.adminToken"]`
- raw RPC URLs

Verify with:
```
grep -rE "EXECUTOR_PRIVATE_KEY|DATABASE_URL|AWS_ACCESS_KEY_ID|sessionStorage" src/app/\(trading\) src/lib/{trading-api,chains,wallet,eip712}.ts src/hooks src/components
```

**End of route map.**
