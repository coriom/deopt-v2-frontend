# Next-task prompt: E2E-LOCAL-TRADING-LIFECYCLE (M-P4)

Copy/paste this prompt verbatim to initiate M-P4.

---

```
Workspace root is ~/DEOPT.

Execute E2E-LOCAL-TRADING-LIFECYCLE only.

This is M-P4 of the product-readiness roadmap. The goal is to
exercise the full DeOpt V2 trading lifecycle end-to-end on a fully
local stack (anvil + postgres + backend + frontend), validating
that signing → broadcasting → confirmation → indexer → reconciliation
all hang together for both orderbook and RFQ paths.

Hard prerequisites:

* BACKEND-TRADING-API-IMPLEMENTATION (M-P2a) — closed.
* BACKEND-TRADING-API-IMPLEMENTATION-PHASE-2 (M-P2b) — closed; the 6
  SOURCE_UNAVAILABLE endpoints now return real data.
* FRONTEND-TRADING-MVP-WIRING (M-P3) — closed.
* FRONTEND-TRADING-SIGNING (M-P3b) — closed; viem added; EIP-712 signing
  flow + intent submission + live tx status wired.

If any of the above is not yet closed, STOP and surface the gap.

Do not deploy.
Do not broadcast against mainnet.
Do not send Sepolia transactions in this milestone.
Do not create Safe transactions.
Do not create AWS resources.
Do not edit production `.env`.
Do not expose secrets.
Do not touch mainnet.
Do not commit any private key (anvil[0] is acceptable in test
fixtures since it's the deterministic public anvil dev key).

Strategic context:

External audit deferred until M-P7 closure. M-P4 ↔ M-P5 (E2E
Sepolia) ↔ M-P6 (public docs) close the product-complete gate. After
M-P6 closure, M-P7 re-anchors the audit handoff bundle to the
product-complete commit.

Goal:
Stand up a local end-to-end harness running anvil + postgres + the
DeOpt backend + the DeOpt frontend, then execute the 9-step orderbook
scenario + 7-step RFQ scenario from
`~/DEOPT/deopt-v2-backend/docs/E2E_TRADING_LIFECYCLE_TEST_PLAN.md §1`.

Test posture: NO live mainnet tx. NO Sepolia tx. Anvil only. The
backend `EXECUTOR_PRIVATE_KEY` may be set to anvil[0] private key (a
public dev key); this is acceptable on local chain id 31337 ONLY. The
mainnet defence-in-depth (`validate_signer_backend`) refuses this
combination if chain id is 8453.

Required Phase A — inspect:

* docs/E2E_TRADING_LIFECYCLE_TEST_PLAN.md §1 (local harness scenarios)
* docs/BACKEND_TRADING_API_IMPLEMENTATION_RESULT.md (current endpoint
  status; gate on M-P2b closure for the deferred 6)
* docs/FRONTEND_TRADING_MVP_WIRING_RESULT.md
* docs/FRONTEND_TRADING_SIGNING_RESULT.md (assumed produced by M-P3b)
* docs/TRADING_UI_MOCK_API_RUNBOOK.md (frontend stack)
* ~/DEOPT/deopt-v2-sol/LOCAL_REHEARSAL.md (sol local deploy
  reference)
* ~/DEOPT/deopt-v2-sol/script/Deploy*.s.sol (deploy scripts)

Required Phase B — harness:

Build a `tests/e2e/` (or `e2e/` at repo root) harness containing:

1. `docker-compose.yml` OR a `run-local-stack.sh` that:
   - starts anvil on :8545 with deterministic accounts;
   - starts postgres on :5432 with a clean schema;
   - deploys sol contracts via `forge script DeployCore` (+
     `ConfigureCore` + `ConfigureMarkets` + `DeployTestnetAssets` +
     `DeployLocalMockFeeds`) against anvil;
   - writes the post-deploy `deployments/local.template.json`-style
     manifest;
   - boots the backend (`cargo run -p deopt-v2-backend`) pointing at the
     local manifest + postgres + anvil RPC;
   - boots the frontend dev server pointing at the backend.

2. A Playwright + viem test harness that:
   - opens the frontend in Chromium with an injected EIP-1193 provider
     (use a small library like `@synthetixio/synpress` if needed, or
     hand-write an injected provider that wraps a viem account with
     anvil[1]'s private key);
   - executes the 9-step orderbook scenario.
   - executes the 7-step RFQ scenario.

Required Phase C — orderbook scenario:

Execute the 9-step scenario from
`E2E_TRADING_LIFECYCLE_TEST_PLAN.md §1.3`:
1. Connect wallet (anvil[1]).
2. Deposit `mUSDC.deposit(10_000e6)`.
3. Browse `/markets/ETH/<expiry>/call`.
4. Trade ticket: size=1, price = mark+1%, click Sign.
5. Wait for confirmation (≤30 anvil-mined blocks).
6. Verify `GET /accounts/anvil1/positions` returns size=1.
7. Advance anvil clock to expiry; exercise.
8. `CV.withdraw(remaining)`.
9. Verify R5 drift = 0 via `GET /admin/fees/vault/reconciliation`.

Required Phase D — RFQ scenario:

Execute the 7-step scenario from §1.4:
1. Connect anvil[1] (taker), anvil[2] (maker).
2. Taker `POST /options/rfqs`.
3. Maker GETs the RFQ.
4. Maker signs quote → POST.
5. Taker accepts.
6. Taker signs execution intent.
7. Confirmation; verify R5 drift = 0.

Required Phase E — failure-case sweep:

Execute the 10 failure cases from §6:
- stale quote (advance clock past quote_expires_at_ms);
- rejected signature (Playwright wallet returns reject);
- failed broadcast (kill anvil mid-broadcast);
- revert (force a bad nonce);
- insufficient collateral (request size > free_collateral);
- signer unavailable (kill backend signer subprocess);
- RPC unavailable (kill anvil);
- network mismatch (switch to chain id 8453);
- backend unhealthy (kill confirmation worker);
- backend unreachable (kill backend).

For each: assert the UI surfaces the correct error code from the
OpenAPI error model + does NOT proceed to broadcast.

Required Phase F — reconciliation:

Verify after both scenarios end:
- `GET /reconciliation/status` → drift = 0;
- `GET /indexer/status` → caught up;
- `GET /trading/health.overall_status` === "ok";
- Cluster 4 launch invariant (`PFV.rebateReserve(asset) === 0`).

Required Phase G — result doc + RUN_STATE:

Create:
- `tests/e2e/E2E_LOCAL_RESULT.md` (or in `~/DEOPT/deopt-v2-backend/docs/`):
  - harness inventory;
  - scenario pass/fail per step;
  - failure-case pass/fail per row;
  - reconciliation result;
  - R5 drift final value;
  - operator-side reproducibility command;
  - blockers;
  - next milestone routing to M-P5 (E2E Sepolia).

Update `~/DEOPT/RUN_STATE.md` with concise closure paragraph:
- harness landed;
- orderbook scenario pass;
- RFQ scenario pass;
- failure cases pass;
- R5 drift = 0;
- next milestone routing.
No secrets.

Validation:

* `forge build` clean.
* `cargo fmt --check`, `cargo clippy`, `cargo test --all-targets --all-features` clean.
* `npx tsc --noEmit`, `npx eslint`, `npx next build` clean.
* Playwright suite passes (orderbook + RFQ + 10 failure cases).
* `git diff --check` clean.
* `git status` shows expected new files only.
* Sensitive-string scan: NO mainnet RPC URLs; NO production EVM
  addresses; NO admin Bearer in test fixtures; NO real AWS values; NO
  DATABASE_URL with production-shaped credentials (test fixture
  `postgres://test:test@localhost/test` is acceptable).

Forbidden:
* no mainnet tx;
* no Sepolia tx (Sepolia E2E is M-P5);
* no live broadcast against any non-local chain;
* no Safe tx;
* no governance / ownership / guardian / Timelock mutation;
* no fee withdrawal / rebate allocation / fund movement;
* no production `.env` edit;
* no AWS resource creation;
* no KMS key creation;
* no deployment of production sol contracts;
* no canary;
* no credentials / RPC URL / DATABASE_URL / API key output beyond
  testnet-safe placeholders;
* no real AWS account IDs / KMS key IDs / KMS ARNs;
* no guessed mainnet executor address;
* no production signer address guess;
* no audit-started claim;
* no audited claim;
* no mainnet-ready claim;
* no admin Bearer token in trading UI;
* no leakage of `sessionStorage["deopt.adminToken"]` into trading
  test fixtures.

Hard stops:
* stop if M-P2b not closed (deferred backend endpoints would block
  full scenarios);
* stop if M-P3b not closed (signing flow would block step 4 of orderbook);
* stop if anvil deploy fails (sol scripts need fixing → escalate
  separately);
* stop if R5 drift becomes non-zero (file as a regression);
* stop if frontend build breaks;
* stop if a failure case unexpectedly reaches the broadcast path.

Return final report grouped by:
workspace,
docs/sources inspected,
harness landed,
orderbook scenario result,
RFQ scenario result,
failure case sweep result,
reconciliation result,
R5 drift,
tests run,
docs created,
RUN_STATE update,
files changed,
validations,
blockers,
next milestone recommendation.
```

---

**End of next-task prompt.**
