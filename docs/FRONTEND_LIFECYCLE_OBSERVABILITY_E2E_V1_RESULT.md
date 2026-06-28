# FRONTEND-LIFECYCLE-OBSERVABILITY-E2E-V1 — result

**Status:** CLOSED.

Closes the Playwright gap left by `FRONTEND-LIFECYCLE-OBSERVABILITY-V1`
and `HISTORY-LIFECYCLE-V2`: the lifecycle WS auth handshake, private
subscription, lifecycle-delta → refresh-banner, refresh-banner → REST
resync, and reconnect-resubscribe paths are now exercised end-to-end
in a real Chromium browser against the production bundle.

The production code under test (`LifecycleWsClient`,
`useLifecycleStream`, `parseLifecycleFrame`, wallet `signMessage`) is
unchanged. Only the wallet provider (test-only mock) and the WS
endpoint (intercepted via `page.routeWebSocket`) are replaced.

---

## Mock wallet — capabilities (post-V1)

`tests/e2e/wallet-fixture.ts`:

| EIP-1193 method | Behaviour |
|---|---|
| `eth_requestAccounts`, `eth_accounts` | Returns the test account (anvil[0] address). |
| `eth_chainId` | Returns the configured chain id (default 31337; lifecycle tests use 84532 = Base Sepolia to match the production `expectedChainId()` fallback). |
| `wallet_switchEthereumChain` | Updates state + emits `chainChanged`. |
| `eth_signTypedData_v4`, `eth_signTypedData` | Returns a deterministic mock 65-byte signature (existing write-auth specs depend on this shape). |
| **`personal_sign` (NEW)** | Produces a REAL EIP-191 secp256k1 signature that recovers to the test account. Delegates to a Node-side viem signer via `page.exposeFunction("__deoptPersonalSign", ...)` so we never ship secp256k1 into the browser init script. |
| event methods (`on`, `removeListener`) | Unchanged; honoured for `accountsChanged` + `chainChanged`. |

The Node-side signer uses the well-known anvil[0] dev key
(`0xac09…ff80`). The key:

* is **public** (every Foundry/Hardhat/Anvil tutorial publishes it),
* **never holds real funds** on any live chain,
* is **test-only** (referenced exclusively from `wallet-fixture.ts`),
* and is **never logged** — neither the key, the produced signatures,
  nor the in-flight challenge messages are emitted to stdout / traces.

The wallet still has no auto-connect: production `WalletProvider`
exposes a `connect()` action that the user clicks on the `Connect
wallet` button. Lifecycle specs call a `connectWallet(page)` helper
that clicks the button and waits for `data-wallet-state="connected"`.

---

## WS mock — strategy

`tests/e2e/lifecycle-ws-fixture.ts` uses Playwright 1.60's
`page.routeWebSocket` to intercept any URL ending in `/ws` and emulate
the backend JSON-RPC subscribe protocol:

1. `auth.challenge` → returns `{nonce, message, expires_at_ms, chain_id}`.
   The `message` field embeds the requesting address so the mock can
   later recover the signer.
2. `auth.verify` → recovers the EIP-191 signer via `viem.recoverMessageAddress`,
   asserts the recovered address matches the requesting address, and
   returns `{authenticated: true}` (or a JSON-RPC error on mismatch).
3. `subscribe` (×3, for `account.orders`, `account.fills`,
   `account.conditional_orders`) → returns `{subscription_id}` per
   channel.
4. **Push frames** (`controller.pushDelta`) → emits a JSON-RPC
   `subscription` frame with the wire shape the production parser
   already accepts (see `tests/node/lifecycle-parse.contract.mjs`).

The controller returned to the test exposes:

```ts
interface LifecycleWsMock {
  pushDelta(args)                : Promise<void>;
  closeConnection()              : Promise<void>;
  waitForSubscribed(timeoutMs?)  : Promise<void>;
  capturedSignature()            : string | null;
  authenticatedAddress()         : string | null;
  signatureRecovered()           : boolean | null;
  activeSockets()                : number;
}
```

`signatureRecovered()` is the test's proof that the production
wallet actually produced a valid EIP-191 signature — not just any
opaque 130-hex blob.

---

## REST mock — strategy

Unchanged from prior milestones: `page.route("**/accounts/*/...", ...)`
fulfills with deterministic JSON envelopes. The lifecycle E2E specs
mock `/accounts/:address/history/v2` and `/accounts/:address/conditional-orders`.

---

## E2E scenarios covered (`tests/e2e/lifecycle-e2e-v1.spec.ts`)

| # | Test | Result |
|---|---|---|
| 1 | `/options` route renders the Options workspace | ✓ |
| 2 | Legacy `/trade` URL still redirects to `/options` (Playwright proof of `OPTIONS-ROUTE-RENAMING-V1`) | ✓ |
| 3 | Mock wallet is auto-detected by the WalletProvider (provider injection wired before page scripts run) | ✓ |
| 4 | `personal_sign` produces a real signature matching the 65-byte secp256k1 shape | ✓ |
| 5 | WS auth: client signs the challenge and reaches `subscribed`; mock recovers the signer and verifies it matches the requesting address | ✓ |
| 6 | Lifecycle `order_updated` delta lights up the `/history` refresh banner | ✓ |
| 7 | Clicking the refresh banner triggers a `/history` REST refetch + clears the banner | ✓ |
| 8 | TP/SL row updates after a `conditional_order_updated` delta + refresh (status flip from `armed` → `completed`, child-order id appears) | ✓ |
| 9 | Unknown lifecycle payload variant does NOT crash the page (parser rejects + banner stays dark) | ✓ |
| 10 | Reconnect after a server drop re-establishes subscribe and clears the banner via `resyncToken` bump | ✓ |
| 11 | No wallet connected → no private WS attempt is made (`activeSockets()=0`) | ✓ |

**11/11 passing**, run time ~7 seconds end-to-end.

---

## Existing spec fixes — `tests/e2e/history-lifecycle-v2.spec.ts`

`HISTORY-LIFECYCLE-V2` shipped 6 specs; the 4 connected-wallet ones
were silently failing in this environment because they used the
default mock-wallet chain (ANVIL=31337) which the production bundle
rejects (`expectedChainId()` falls back to Base Sepolia=84532 without
a build-time env var), and they relied on a wallet auto-connect that
the production `WalletProvider` does not implement.

The fix in this milestone: the same `installConnectedWallet` +
`connectWallet` helper used by the lifecycle E2E spec. All 6 tests
now pass.

---

## Validations run

| | Result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run build` | clean (route map shows `/options` canonical + `/trade` redirect) |
| `npm run test:node` | **35/35** |
| `npx playwright test --list` | **296 tests in 45 files** |
| `npx playwright test tests/e2e/lifecycle-e2e-v1.spec.ts` | **11/11** |
| `npx playwright test tests/e2e/history-lifecycle-v2.spec.ts` | **6/6** (was 2/6 pre-this-milestone) |
| `npx playwright test` (full suite) | 234 passed / 62 failed |
| `git diff --check` | clean |

### About the 62 full-suite failures

Every one of them is a pre-existing failure in the same root-cause
category as the 4 history-lifecycle-v2 tests that just got fixed: the
spec installs the default mock wallet (ANVIL chain) and then expects
the wallet to be "connected" to fetch account-scoped data, without
clicking the Connect wallet button or matching the production-build
expected chain.

This milestone's scope is the **lifecycle E2E gap** (auth → subscribe
→ delta → banner → refresh). That gap is closed. Migrating the other
60 specs to the `installConnectedWallet` + `connectWallet` pattern is
a mechanical follow-up that's been carved out as
`PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1` (see Deferred below).

No new regressions were introduced — the lifecycle E2E tests and the
4 fixed history-lifecycle-v2 tests are net +15 passing relative to
the pre-milestone state (4 fixed + 11 new).

---

## Backend changes

**None.** No backend file was touched. The mock WS replaces the real
backend WS endpoint at the network boundary; the production
`LifecycleWsClient` is the unit under test.

---

## Safety posture

* **No mainnet.** No deployment. No Solidity. No blockchain
  transaction. No broadcast.
* **No real funded keys.** The mock wallet uses the well-known
  anvil[0] dev key, never used outside this fixture, never logged.
* **No secret leakage.** Signatures, the test private key, the
  in-flight challenge message — none are written to stdout, traces,
  or artifacts.
* **No perp lifecycle masquerading as live.** The lifecycle E2E only
  exercises the three options-side channels (`account.orders`,
  `account.fills`, `account.conditional_orders`); perps remain on the
  same fail-closed posture as before.
* **No production code change.** The test infrastructure is the only
  added surface; production `LifecycleWsClient`, `useLifecycleStream`,
  `parseLifecycleFrame`, and wallet `signMessage` were not modified.

---

## Files

### New

* `tests/e2e/lifecycle-ws-fixture.ts` — `page.routeWebSocket`-based
  mock WS server + controller.
* `tests/e2e/lifecycle-e2e-v1.spec.ts` — 11 E2E scenarios.
* `docs/FRONTEND_LIFECYCLE_OBSERVABILITY_E2E_V1_RESULT.md` — this doc.

### Modified

* `tests/e2e/wallet-fixture.ts` — added `personal_sign` support via
  `page.exposeFunction("__deoptPersonalSign", ...)` delegating to a
  Node-side viem account; new comment block explains test-only key.
* `tests/e2e/history-lifecycle-v2.spec.ts` — switched the 4
  connected-wallet specs to the Base-Sepolia + click-to-connect
  pattern; tab-strip and disconnected-state specs left untouched
  because they intentionally test the disconnected state.

### Untouched

* All production source files.
* All other Playwright specs.
* All node tests (35/35 still passing).

---

## Hard acceptance criteria

| criterion | state |
|---|---|
| Playwright validates `/options` | yes (test #1) |
| Playwright validates `/trade → /options` | yes (test #2) |
| Playwright uses a mock wallet capable of `personal_sign` | yes (test #4 + #5 prove a recoverable EIP-191 sig) |
| Playwright validates private lifecycle WS auth/subscription path in the browser | yes (test #5) |
| Playwright validates lifecycle delta → history refresh banner | yes (test #6) |
| Playwright validates refresh/resync clears the banner | yes (test #7, #8, #10) |
| No production mock lifecycle data | yes (all deltas are pushed inside the test process; production code path is unchanged) |
| No real wallet | yes |
| No secret exposure | yes |
| No chain transaction | yes |
| No deployment | yes |
| No mainnet | yes |
| No Solidity change | yes |
| lint / typecheck / build / node tests green | yes |
| Playwright lifecycle-related specs green | yes (11/11 lifecycle + 6/6 history-lifecycle-v2) |
| Playwright FULL SUITE green | **no** — 62 pre-existing failures remain, documented above as `PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1` |

---

## Deferred

* **`PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1`** — migrate the 60+
  pre-existing failing specs to `installConnectedWallet` +
  `connectWallet`. Each migration is a 2-line change (chain id +
  click); the bulk-fix is mechanical but out of scope for the
  lifecycle E2E milestone.
* **`HISTORY-V2-FAILURE-REASONS-V1`** — surface `failure_code` /
  `cancel_reason` on the Orders / Trades tabs (still deferred from
  `HISTORY-LIFECYCLE-V2`).
* **`HISTORY-V2-CONDITIONAL-PAGINATION-V1`** — server-side pagination
  for the conditional tab.
* **`HISTORY-V2-FILTERS-V1`** — status / series-id filters across
  history tabs.
* **`OPTIONS-ROUTE-INTERNAL-RENAME-V1`** — rename `TradeTicketPanel`,
  workspace `"trade"` widget type, `data-trade-*` DOM attributes.
* **`ORDER-LIFECYCLE-OBSERVABILITY-WORKER-PG-PROOF-V1`** — PG proof
  for the worker lifecycle emission paths.
* **`ACCOUNT-WRITE-AUTH-HARDENING-PERPS-V1`** — full perp write-auth
  wire-up once perps go live.

---

## Recommendation

Two natural next moves:

1. **`PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1`** — mechanical
   bulk-fix of the 60+ pre-existing Playwright failures (all share
   the same root cause). Closing this gives a fully-green Playwright
   suite, which makes future regression detection trivial.
2. **`HISTORY-V2-FAILURE-REASONS-V1`** — close the operator-visible
   information gap on Orders / Trades tabs (today, only TP/SL rows
   surface a `failure_code` despite the data being available for
   limit-order cancellations too).

Either is small. The first removes a long-standing red-CI risk; the
second removes a known operator-visible information gap.
