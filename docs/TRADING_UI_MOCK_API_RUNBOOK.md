# Trading UI — Mock API Runbook (M-P3)

**Date:** 2026-06-10
**Audience:** frontend developers wiring the trading MVP UI before the
M-P2b backend implementation closes.

## Purpose

The M-P2a backend implements 5 of 12 trading endpoints REAL + 1 PARTIAL +
6 as `SOURCE_UNAVAILABLE` typed envelopes (per
`~/DEOPT/deopt-v2-backend/docs/BACKEND_TRADING_API_IMPLEMENTATION_RESULT.md`).
The UI gracefully renders both cases, but during local iteration you may
want **fully synthetic responses** for every endpoint. Prism mock against
the OpenAPI spec gives you that.

## Mode A — Frontend against real M-P2a backend (default)

```bash
# Terminal 1 — backend
cd ~/DEOPT/deopt-v2-backend
DATABASE_URL=... cargo run

# Terminal 2 — frontend
cd ~/DEOPT/deopt-v2-frontend
npm install   # one-time
NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:3000 \
NEXT_PUBLIC_CHAIN_ENV=anvil \
npm run dev
```

You'll see:
- `/`, `/markets` populated by the option-series store (empty in default state).
- `/portfolio`, `/markets/:id` → `SOURCE_UNAVAILABLE` amber "not yet wired" cards in the panels backed by deferred endpoints.
- `/history` populated by indexed fills (empty in default state).
- `/trading/health` real, derived from backend executor health subset.

## Mode B — Frontend against Prism mock (synthetic fixtures)

```bash
# Terminal 1 — Prism mock against OpenAPI spec
cd ~/DEOPT
npx @stoplight/prism mock \
  deopt-v2-backend/docs/openapi/trading-api.openapi.json \
  --port 4010

# Terminal 2 — frontend
cd deopt-v2-frontend
NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:4010 \
NEXT_PUBLIC_CHAIN_ENV=sepolia \
npm run dev
```

Prism returns spec `examples` (or generates from schemas) for every
endpoint, so all UI panels render with synthetic data.

## Useful flags

| Flag | Effect |
|---|---|
| `--dynamic` | Generate fresh random data per request (not just static examples). |
| `--cors` | Auto-enable permissive CORS (frontend runs on :3000 / :3001; Prism on :4010). |
| `--verbose` | Trace each request. |
| `-h` | Bind to 0.0.0.0 for cross-host access (e.g. mobile testing). |

## Switching environments

The frontend reads `NEXT_PUBLIC_TRADING_API_BASE_URL` at build time AND
at runtime (for Next.js server components). In dev mode, restart the
dev server after `.env.local` changes:

```bash
# Stop dev server, then
NEXT_PUBLIC_TRADING_API_BASE_URL=http://new-url npm run dev
```

## Sanity checks

```bash
# Spec validates
python3 -c "import json; json.load(open('../deopt-v2-backend/docs/openapi/trading-api.openapi.json'))"

# Prism running?
curl http://localhost:4010/trading/health

# Frontend connects?
# (open /health in the browser; the card should show "ok"/"degraded"/"unhealthy")
```

## Notes

- **Do NOT** set `NEXT_PUBLIC_CHAIN_ENV=mainnet`. Even if you do,
  `chains.ts::expectedChainId()` silently downgrades to Sepolia
  (defence-in-depth), and `MainnetDisabledBanner` would still trigger
  on wallet connect.
- **Do NOT** point trading API to a production URL. The `.env.example`
  values are explicit testnet placeholders.

**End of runbook.**
