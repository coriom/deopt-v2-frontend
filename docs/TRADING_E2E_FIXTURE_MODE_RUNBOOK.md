# TRADING E2E Fixture-Mode Runbook (M-P4d)

**Date:** 2026-06-10
**Audience:** frontend / QA developers running the local Playwright
tx-status suite.

> **Update (M-P3c, 2026-06-10):** the suite now also covers the
> Trade-Ticket Step 1 (Create intent) flow via
> `tests/e2e/create-intent.spec.ts` (5 specs). The fixture-mode
> patterns documented below apply unchanged.
**Posture:** local-only. **No mainnet. No live tx. No real wallet.
No real signing. No admin Bearer in trading UI. No `.env` edit.**

## 1. Two modes — one suite

The Playwright tx-status suite (`tests/e2e/tx-status-cycler.spec.ts`)
runs in two modes, automatically chosen per-spec:

* **fixture mode** — backend M-P4c local-test cycler reachable on
  `E2E_BACKEND_URL` (default `http://localhost:8080`). The spec creates
  a real synthetic intent, drives it via the cycler, then asserts the
  UI renders the resulting state.
* **fallback mode** — backend not reachable, fixture disabled, OR
  responds to the create probe with anything other than HTTP 200. The
  spec falls back to a deterministic synthetic intent id and pure
  `page.route` interception. Identical UI assertions.

Both modes use the same `mountIntentTranslation` page-route translator;
the only difference is whether a real `intent_id` was minted via the
backend or synthesised via `fallbackIntentId(seed)`.

## 2. One-time setup

```bash
cd ~/DEOPT/deopt-v2-frontend
npm install
npm run e2e:install      # downloads chromium (~100 MB; one-time)
```

## 3. Fixture mode — backend + frontend running

In four terminals:

```bash
# Terminal A — anvil
cd ~/DEOPT
anvil --chain-id 31337

# Terminal B — backend with fixture enabled
#
# CRITICAL: this runbook does NOT instruct you to edit a production
# .env. The fixture is enabled at compile / boot time by direct field
# mutation only. Local dev binaries live under `examples/` or
# `bin/local_*`. The fixture refuses chain_id 8453 unconditionally.
cd ~/DEOPT/deopt-v2-backend
cargo run --bin deopt-v2-backend         # uses .env.local with anvil chain_id 31337
# Then in a small bootstrap script (NOT documented here):
#   state.local_test_fixtures = LocalTestFixturesConfig::enabled_for_chain_id(31337);

# Terminal C — frontend dev server
cd ~/DEOPT/deopt-v2-frontend
npm run dev

# Terminal D — Playwright
cd ~/DEOPT/deopt-v2-frontend
E2E_BACKEND_URL=http://localhost:8080 npm run e2e:local
```

The Playwright suite probes the backend at start; if the probe returns
HTTP 200 with `synthetic: true`, it runs in fixture mode.

## 4. Fallback mode — frontend only

```bash
# Terminal A — frontend dev server
cd ~/DEOPT/deopt-v2-frontend
npm run dev

# Terminal B — Playwright (no backend)
cd ~/DEOPT/deopt-v2-frontend
npm run e2e:local
```

Probe fails → suite logs `[<scenario>] FALLBACK MODE (<reason>)` for
each spec → page-route translators serve synthetic responses → all
UI assertions still pass.

## 5. Helper API summary

`tests/e2e/backend-fixture.ts` surface:

```ts
import {
  probeBackendFixture,
  createSyntheticIntent,
  transitionSyntheticIntent,
  readSyntheticTxStatus,
  mountIntentTranslation,
  unmountIntentTranslation,
  fallbackIntentId,
  mapBackendToFrontendStatus,
  type BackendFixtureStatus,
  type FrontendIntentStatus,
} from "./backend-fixture";
```

Typical spec pattern:

```ts
const probe = await probeBackendFixture(request);
let intentId: string;

if (probe.mode === "fixture") {
  const created = await createSyntheticIntent(request, probe.backendUrl);
  intentId = created.intent_id;
  await transitionSyntheticIntent(request, probe.backendUrl, intentId, "pending");
  await transitionSyntheticIntent(request, probe.backendUrl, intentId, "confirmed");
} else {
  intentId = fallbackIntentId("my-scenario");
}

await mountIntentTranslation(page, { intentId, status: "confirmed" });
await page.goto(`/transactions/${intentId}`);
await expect(page.getByText("CONFIRMED").first()).toBeVisible();
```

## 6. Status mapping (M-P4c backend → frontend UI)

| Backend status | UI status | UI rendering |
|---|---|---|
| `created` | `CREATED` | first stage highlighted |
| `pending` | `BROADCAST` | broadcast stage highlighted; synthetic tx hash visible |
| `confirmed` | `CONFIRMED` | terminal stage highlighted |
| `failed` | `REVERTED` | red banner + `synthetic failed (M-P4c cycler)` |
| `reverted` | `REVERTED` | red banner + `synthetic revert (M-P4c cycler)` |
| `stuck` | `STUCK` | amber banner + `operator review pending` |

Allowed transitions enforced by the backend:

```
Created  →  Pending  →  Confirmed  (terminal)
                    →  Failed     (terminal)
                    →  Reverted   (terminal)
                    →  Stuck      →  Pending | Failed
```

## 7. Defence-in-depth — what is NEVER permitted

* The trading UI runtime NEVER fetches `/admin/test/*`. Asserted at
  the page level by `no-admin-bearer.spec.ts` AND per-spec by
  `assertNoAdminBearer` in `tx-status-cycler.spec.ts`.
* The trading UI runtime NEVER attaches an `Authorization` header to
  ANY backend XHR. Same assertions.
* No admin Bearer token is read into the browser app's window scope.
* No real wallet private key is used. The wallet fixture's signature
  is a deterministic 130-hex-char shape; rejecting it returns the
  EIP-1193 code 4001 surface.
* No `.env.local` edit is required for the suite to run; the dev
  server's existing config is sufficient.
* The cycler is mainnet-refused by 4 independent backend gates AND by
  the Playwright helper which refuses to be useful when the backend
  reports `chain_id == 8453`.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| All specs run in fallback mode | backend not reachable | start the backend on `E2E_BACKEND_URL` (default `http://localhost:8080`) |
| `probeBackendFixture` returns fallback but backend is up | fixture disabled OR `chain_id == 8453` | enable `LocalTestFixturesConfig::enabled_for_chain_id(state.chain_id)` in the local backend boot; ensure chain_id != 8453 |
| `playwright test` says chromium not installed | one-time download skipped | `npm run e2e:install` |
| Spec passes locally, fails in CI | backend not started in CI | CI runs fallback mode by default — that's the intended behaviour, no fix needed |
| `0xdeadbee5…` not visible | translator not mounted, or wrong intent_id in the URL | check the `intentId` parameter passed to `mountIntentTranslation` matches the page URL |
| `STUCK` spec sees CONFIRMED | terminal transition applied before mount | confirm transition sequence: `created → pending → stuck` (NOT `created → pending → confirmed → stuck`) |
| Suite says fallback but a previous spec polluted Playwright cache | per-spec route handlers leak | call `unmountIntentTranslation(page, intentId)` at end of multi-intent specs |

## 9. Operator command cheat sheet

| Goal | Command |
|---|---|
| Install Playwright + chromium | `npm install && npm run e2e:install` |
| Run all specs (fallback-friendly) | `npm run e2e:local` |
| Run all specs against a backend cycler | `E2E_BACKEND_URL=http://localhost:8080 npm run e2e:local` |
| Run only the tx-status cycler specs | `npx playwright test tx-status-cycler` |
| Inspect spec list without executing | `npx playwright test --list` |
| Generate HTML trace report after a failure | `npx playwright show-report` |

## 10. Cross-links

* `FRONTEND_PLAYWRIGHT_TX_STATUS_CYCLER_WIRING_RESULT.md` (this milestone result)
* `TRADING_TX_STATUS_WIRING.md` (production polling hook reference)
* `TRADING_UI_MOCK_API_RUNBOOK.md` (Prism / route-intercept mock mode)
* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_TX_STATUS_CYCLER_RUNBOOK.md` (backend cycler runbook)
* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_AUTOMATION_RUNBOOK.md` (overall Playwright runbook)

**End of fixture-mode runbook.**
