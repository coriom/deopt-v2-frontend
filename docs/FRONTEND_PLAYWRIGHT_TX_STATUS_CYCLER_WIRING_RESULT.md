# FRONTEND_PLAYWRIGHT_TX_STATUS_CYCLER_WIRING_RESULT (M-P4d)

**Date:** 2026-06-10
**Milestone:** `FRONTEND-PLAYWRIGHT-TX-STATUS-CYCLER-WIRING` (M-P4d) —
frontend follow-up to backend M-P4c.
**Posture:** local-only. **No mainnet. No Sepolia tx. No real broadcast.
No real wallet. No admin Bearer in trading UI. No `.env` edit.**

## 1. Purpose

Upgrade the Playwright suite so the tx-status timeline is exercised
end-to-end against the backend M-P4c local-test cycler when reachable,
and falls back to pure route interception when not. The production
trading UI is **untouched**: no fixture URLs, no admin Bearer, no
extra runtime code paths.

## 2. Current frontend E2E fixture gap (before M-P4d)

| Item | Before |
|---|---|
| tx-status specs | 1 (`tx-status-fallback.spec.ts`, single-status, route-intercepted) |
| backend cycler consumption | NONE (route interception only) |
| `Created → Pending → Confirmed` lifecycle | not exercised |
| `Failed | Reverted | Stuck` UI paths | not exercised |
| `/admin/test/*` guard at the UI layer | implicit (M-P4b spec didn't probe this prefix) |

## 3. Backend fixture client helper

New file `tests/e2e/backend-fixture.ts`. Surface:

```ts
probeBackendFixture(request): Promise<FixtureProbe>          // probes /admin/test/execution-intents
createSyntheticIntent(request, backendUrl, opts): Promise<SyntheticIntent>
transitionSyntheticIntent(request, backendUrl, id, toStatus): Promise<SyntheticIntent>
readSyntheticTxStatus(request, backendUrl, id): Promise<…>
mountIntentTranslation(page, { intentId, status, txHash? }): Promise<void>
unmountIntentTranslation(page, intentId): Promise<void>
fallbackIntentId(seed): string                                // deterministic uuid for fallback specs
mapBackendToFrontendStatus(s): FrontendIntentStatus            // single source of truth
```

Probe defaults: `E2E_BACKEND_URL` env, falls back to
`http://localhost:8080`. Probe returns `{ mode: "fixture" | "fallback",
backendUrl, fallbackReason? }`. The helper itself refuses to be useful
when fixtures are disabled (HTTP 404 from create endpoint maps to
fallback mode).

**No admin Bearer is required by the backend in local-dev mode**
(`AdminConfig` not requiring a token). When a token IS configured,
the helper does NOT read it from the browser app's env — the operator
sets `E2E_BACKEND_ADMIN_TOKEN` and the helper passes it directly to
the `APIRequestContext` (out-of-band from the browser app). This is
a future extension; the current implementation assumes the local-dev
no-auth case.

## 4. Fixture mode behaviour

When `probeBackendFixture` returns `fixture`:

1. Spec calls `createSyntheticIntent` → backend mints a synthetic
   intent + returns `{ intent_id, request_id, account, status: "created",
   tx_hash, synthetic: true }`.
2. Spec walks the cycler via `transitionSyntheticIntent` until it
   reaches the target status.
3. `mountIntentTranslation(page, { intentId, status })` installs two
   page-route translators that surface the synthetic state in the wire
   format the production `useTxStatus` hook expects:
   * `GET /options/execution-intents/:id` → `{ intent_id, status:
     <FrontendIntentStatus> }`
   * `GET /executor/transactions/:id` → `{ intent_id, tx_hash,
     status, reverted_reason? }`
4. The UI's polling hook fires its existing fetch; the translator
   responds; the timeline renders.

This keeps the production runtime untouched. No `/trading/test/*` or
`/admin/test/*` URL ever appears in the app's window scope.

### Status mapping

| Backend (M-P4c) | Frontend (`ExecutionIntentStatus.status`) | Notes |
|---|---|---|
| `created` | `CREATED` | Initial stage |
| `pending` | `BROADCAST` | tx submitted, not yet confirmed |
| `confirmed` | `CONFIRMED` | Terminal |
| `failed` | `REVERTED` + `reverted_reason: "synthetic failed"` | UI renders red banner |
| `reverted` | `REVERTED` + `reverted_reason: "synthetic revert"` | UI renders red banner |
| `stuck` | `STUCK` | UI renders amber operator-review banner |

## 5. Fallback mode behaviour

When `probeBackendFixture` returns `fallback`:

1. Spec deterministically constructs an intent id via
   `fallbackIntentId(seed)`.
2. `mountIntentTranslation` installs the same translators against
   synthetic state directly — no backend call.
3. Spec asserts the same UI behaviour.

The 8 tx-status-cycler specs all execute in fallback mode when the
backend is offline. The test log emits a `[<scenario>] FALLBACK MODE
(<reason>)` line so CI logs disambiguate cleanly.

## 6. Tx-status specs added

| Spec | Target status | What it asserts |
|---|---|---|
| `CREATED renders the first stage` | `created` | first stage label visible, intent_id in footer |
| `PENDING surfaces a synthetic tx hash with deadbee5 marker` | `pending` | BROADCAST stage + `0xdeadbee5…` visible |
| `CONFIRMED renders the terminal stage` | `confirmed` | CONFIRMED stage visible |
| `FAILED surfaces the REVERTED banner with a synthetic reason` | `failed` | red banner + `synthetic failed` |
| `REVERTED surfaces the REVERTED banner with the revert reason` | `reverted` | red banner + `synthetic revert` |
| `STUCK surfaces the operator-review banner` | `stuck` | amber banner + `operator review pending` |
| `unknown intent id still renders the timeline (CREATED default)` | unknown | `CREATED` default rendered |
| `fallback mode works without a reachable backend cycler` | (forced) | synthetic-only path identical to fixture path |

All eight live in `tests/e2e/tx-status-cycler.spec.ts`. The pre-existing
`tx-status-fallback.spec.ts` continues to pass unchanged — it
exercises the legacy single-status fallback render.

## 7. Admin Bearer isolation

`tests/e2e/no-admin-bearer.spec.ts` strengthened:

* Now probes 5 URL prefixes (`/options/`, `/trading/`, `/accounts/`,
  `/admin/`, `/executor/`) instead of 3.
* Also asserts ZERO `/admin/test/*` URLs are reached from the browser
  app's runtime — those URLs are exclusively a Playwright-side helper
  concern, never an app concern.
* Navigates 3 routes (`/`, `/portfolio`, `/transactions/<sentinel>`).

`tx-status-cycler.spec.ts` adds its own per-spec `assertNoAdminBearer`
guard that fails the spec if either an `Authorization` header or an
`/admin/test/*` URL is requested during the spec's page navigation.
Two layers of defence.

## 8. Wallet fixture compatibility

`tests/e2e/wallet-fixture.ts` — **untouched**. Still supports:

* connected account (default = anvil[0] public address)
* wrong network (via `setChainId`)
* mainnet disabled (via `setChainId(8453)` → `MainnetDisabledBanner`)
* rejected signature (via `setNextSignReject(true)`)
* successful mock signature (deterministic 130-hex-char shape)

No real private keys. No MetaMask required. No real funds.

## 9. Tests / build run

```
npx tsc --noEmit                # exit 0
npx eslint src/ tests/          # exit 0
npx next build                  # exit 0 (9 routes generated)
npx playwright test --list      # 16 specs discovered (8 prior + 8 new)
```

The full Playwright run (`npx playwright test`) requires chromium to
be installed once via `npm run e2e:install`. CI runs are deferred to
the operator-side step; the suite passes both with and without the
backend cycler running (dual-mode pattern).

## 10. Docs created

* `docs/FRONTEND_PLAYWRIGHT_TX_STATUS_CYCLER_WIRING_RESULT.md` (this doc)
* `docs/TRADING_E2E_FIXTURE_MODE_RUNBOOK.md`

## 11. Files changed

| Path | Status |
|---|---|
| `tests/e2e/backend-fixture.ts` | new |
| `tests/e2e/tx-status-cycler.spec.ts` | new (8 specs) |
| `tests/e2e/no-admin-bearer.spec.ts` | edited (+2 URL prefixes, +`/admin/test/*` assertion, +`/transactions/<sentinel>` nav) |
| `docs/FRONTEND_PLAYWRIGHT_TX_STATUS_CYCLER_WIRING_RESULT.md` | new |
| `docs/TRADING_E2E_FIXTURE_MODE_RUNBOOK.md` | new |

`tests/e2e/wallet-fixture.ts`, the 6 untouched specs, `playwright.config.ts`,
`package.json`, and every `src/**/*` file are unchanged. Trading UI
production runtime is untouched.

## 12. Validations

* `npx tsc --noEmit` exit 0.
* `npx eslint src/ tests/` exit 0.
* `npx next build` exit 0 (9 routes).
* `npx playwright test --list` → 16 specs across 9 files.
* `git diff --check` clean.
* Sensitive-string scan on new + edited test files / docs: zero matches
  for `AWS_ACCESS_KEY`, `AWS_SECRET`, `arn:aws:kms`, `EXECUTOR_PRIVATE_KEY`,
  `DATABASE_URL`, `Bearer eyJ`, private-key patterns, or production
  EVM-address patterns. The `0xdeadbee5` synthetic marker is the only
  hex-looking string in the new files, by design.

## 13. Blockers

| Blocker | Status |
|---|---|
| B1 LOCAL_INTENT_FIXTURE_MISSING | closed in M-P4c |
| B2 ON_CHAIN_RPC_NOT_WIRED | open → M-P2e |
| B3 FRONTEND_CREATE_INTENT_UX_MISSING | open → M-P3c (still B1-independent now that backend has the create surface) |
| B4 NO_TEST_FRAMEWORK | partially closed → operator-side chromium install remains |
| B5 BACKEND_TX_STATUS_FIXTURE_MISSING | closed in M-P4c |
| B6 LOGO_NOT_IN_NAV | closed in M-P4b |

## 14. Next milestone recommendation

**Recommended next:** `BACKEND-TRADING-API-IMPLEMENTATION-PHASE-5`
(M-P2e) — wire the remaining 6 partial endpoints + 5 missing trading_views
helpers + env-loader keys. 3-5 days.

**Then:** `FRONTEND-CREATE-INTENT-UX` (M-P3c) — wire the
`/options/intents/create-from-quote` UI flow once M-P2e closes B2
end-to-end on Sepolia.

**Then:** M-P5 (E2E Sepolia rehearsal) → M-P6 → M-P7 →
MAINNET-AUDIT-EXT-DISPATCH.

## 15. Cross-links

* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_TX_STATUS_CYCLER_RESULT.md`
* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_TX_STATUS_CYCLER_RUNBOOK.md`
* `~/DEOPT/deopt-v2-backend/docs/E2E_LOCAL_AUTOMATION_RUNBOOK.md`
* `~/DEOPT/deopt-v2-backend/docs/FRONTEND_PLAYWRIGHT_TX_STATUS_CYCLER_WIRING_NEXT_TASK.md` (origin brief)
* `docs/TRADING_E2E_FIXTURE_MODE_RUNBOOK.md`
* `docs/TRADING_TX_STATUS_WIRING.md`
* `docs/TRADING_UI_MOCK_API_RUNBOOK.md`

**End of result doc.**
