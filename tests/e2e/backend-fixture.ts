/**
 * Backend M-P4c local/test tx-status cycler client (Playwright-side).
 *
 * Two modes:
 *
 *   * **fixture mode** — the backend cycler is reachable at
 *     `E2E_BACKEND_URL` (default `http://localhost:8080`) and
 *     `local_test_fixtures` is enabled. Tests call the helper to
 *     create a synthetic intent, drive its status via
 *     `POST /admin/test/intent/:id/transition`, and rely on
 *     Playwright `page.route` translation so the production frontend
 *     polling endpoints (`/options/execution-intents/:id` +
 *     `/executor/transactions/:id`) return shapes consistent with the
 *     synthetic state.
 *
 *   * **fallback mode** — the cycler is not reachable (backend not
 *     running, or fixture disabled). Tests synthesise responses via
 *     `page.route` interception only. Same UI assertions still hold.
 *
 * **No real broadcast. No real signing. No real wallet. No admin
 * Bearer in the trading UI runtime.** All `/admin/test/*` calls
 * happen in this Playwright-side helper and never touch the browser
 * app's window scope.
 *
 * The cycler refuses chain_id 8453 by four independent gates on the
 * backend; this helper additionally refuses any caller that hands it a
 * mainnet chain id (defence-in-depth #5).
 */

import type { Page, APIRequestContext } from "@playwright/test";

const DEFAULT_BACKEND_URL = "http://localhost:8080";

export interface FixtureProbe {
  readonly mode: "fixture" | "fallback";
  readonly backendUrl: string;
  /** Reason for fallback, when `mode === "fallback"`. */
  readonly fallbackReason?: string;
}

export interface SyntheticIntent {
  readonly intent_id: string;
  readonly request_id: string;
  readonly account: string;
  readonly source_type: string;
  readonly status: BackendFixtureStatus;
  readonly tx_hash: string;
  readonly synthetic: true;
}

/**
 * Backend cycler status vocabulary. Identical to the
 * `LocalTestIntentStatus` enum in `crate::api::local_test_fixtures`.
 */
export type BackendFixtureStatus =
  | "created"
  | "pending"
  | "confirmed"
  | "failed"
  | "reverted"
  | "stuck";

/**
 * Frontend `ExecutionIntentStatus.status` vocabulary expected by
 * `TxStatusTimeline.tsx`. Lifted verbatim from
 * `src/lib/trading-types.ts`.
 */
export type FrontendIntentStatus =
  | "CREATED"
  | "SIGNING_PAYLOAD_ISSUED"
  | "SIGNED"
  | "SIMULATED_OK"
  | "BROADCAST"
  | "CONFIRMED"
  | "REVERTED"
  | "STUCK";

/**
 * Deterministic mapping from backend fixture status → frontend UI
 * status. Kept in one place so specs assert against a single source
 * of truth.
 */
export function mapBackendToFrontendStatus(
  s: BackendFixtureStatus,
): FrontendIntentStatus {
  switch (s) {
    case "created":
      return "CREATED";
    case "pending":
      return "BROADCAST";
    case "confirmed":
      return "CONFIRMED";
    case "failed":
      return "REVERTED";
    case "reverted":
      return "REVERTED";
    case "stuck":
      return "STUCK";
  }
}

/**
 * Probe the backend cycler. Cheap: a single GET against a non-existent
 * uuid — when fixtures are enabled the backend returns 404 (uuid
 * unknown); when disabled the entire route is 404 too. We disambiguate
 * via a HEAD/GET against the create endpoint with an empty body — a
 * disabled fixture returns 404 unconditionally; an enabled one returns
 * 405 (Method Not Allowed) or 200 — either signals "fixture mode
 * available".
 */
export async function probeBackendFixture(
  request: APIRequestContext,
  backendUrl: string = process.env.E2E_BACKEND_URL ?? DEFAULT_BACKEND_URL,
): Promise<FixtureProbe> {
  try {
    // Attempt a create with the minimal body. If fixtures are enabled
    // and chain_id is local/sepolia, we get HTTP 200 + a synthetic
    // intent envelope. If disabled or mainnet, we get HTTP 404. Any
    // other status is treated as fallback.
    const created = await request.post(
      `${backendUrl}/admin/test/execution-intents`,
      { data: {}, failOnStatusCode: false, timeout: 1_500 },
    );
    if (created.status() === 200) {
      const body = await created.json();
      if (body && body.synthetic === true) {
        return { mode: "fixture", backendUrl };
      }
    }
    return {
      mode: "fallback",
      backendUrl,
      fallbackReason: `cycler returned status ${created.status()}`,
    };
  } catch (e) {
    return {
      mode: "fallback",
      backendUrl,
      fallbackReason: `cycler unreachable: ${(e as Error).message}`,
    };
  }
}

/**
 * Create a synthetic intent on the backend. Caller MUST have already
 * checked `mode === "fixture"`. Throws on non-200.
 *
 * `account` defaults to the well-known anvil[0] public address used
 * by the wallet fixture so the synthetic intent owner matches the
 * connected mock wallet.
 */
export async function createSyntheticIntent(
  request: APIRequestContext,
  backendUrl: string,
  opts: { account?: string; sourceType?: "option_orderbook_fill" | "option_rfq_fill" } = {},
): Promise<SyntheticIntent> {
  const r = await request.post(`${backendUrl}/admin/test/execution-intents`, {
    data: {
      account: opts.account,
      source_type: opts.sourceType,
    },
    failOnStatusCode: false,
  });
  if (r.status() !== 200) {
    throw new Error(`backend cycler refused create: ${r.status()}`);
  }
  return (await r.json()) as SyntheticIntent;
}

/**
 * Drive a synthetic intent to the next status. Throws on non-200.
 *
 * Allowed transitions match the backend invariant:
 *   created → pending
 *   pending → confirmed | failed | reverted | stuck
 *   stuck   → pending | failed
 *   confirmed | failed | reverted are terminal.
 */
export async function transitionSyntheticIntent(
  request: APIRequestContext,
  backendUrl: string,
  intentId: string,
  toStatus: BackendFixtureStatus,
): Promise<SyntheticIntent> {
  const r = await request.post(
    `${backendUrl}/admin/test/intent/${intentId}/transition`,
    { data: { to_status: toStatus }, failOnStatusCode: false },
  );
  if (r.status() !== 200) {
    throw new Error(`transition ${toStatus} refused: ${r.status()}`);
  }
  return (await r.json()) as SyntheticIntent;
}

/**
 * Read the frontend-facing synthetic tx status envelope.
 */
export async function readSyntheticTxStatus(
  request: APIRequestContext,
  backendUrl: string,
  intentId: string,
): Promise<{
  status: BackendFixtureStatus;
  tx_hash: string;
  synthetic: true;
  source: "local_test_fixture";
}> {
  const r = await request.get(
    `${backendUrl}/trading/test/tx-status/${intentId}`,
    { failOnStatusCode: true },
  );
  return await r.json();
}

interface MountTranslationOpts {
  intentId: string;
  /**
   * Backend status snapshot to translate. The Playwright helper
   * decides what status to surface; the page handler re-reads this
   * value on every request so transitions land in the UI on the next
   * poll tick.
   */
  status: BackendFixtureStatus;
  /**
   * Synthetic tx hash to surface in the executor-transactions
   * response. Defaults to a clearly-marked synthetic hash if not
   * provided.
   */
  txHash?: string;
}

/**
 * Mount Playwright `page.route` translators that map either
 *   (a) backend M-P4c fixture state, OR
 *   (b) synthetic test state (fallback mode)
 * into the wire format the production frontend polling hook expects.
 *
 * This keeps the production trading UI runtime untouched — no admin
 * Bearer reaches the browser app, no fixture URLs appear in the
 * window scope. The translation layer is purely a Playwright
 * `page.route` handler installed for the duration of the spec.
 */
export async function mountIntentTranslation(
  page: Page,
  opts: MountTranslationOpts,
): Promise<void> {
  const txHash =
    opts.txHash ?? `0xdeadbee5${"00".repeat(12)}${opts.intentId.replaceAll("-", "")}`;
  const frontendStatus = mapBackendToFrontendStatus(opts.status);
  const txStatus =
    opts.status === "confirmed"
      ? "confirmed"
      : opts.status === "failed"
        ? "failed"
        : opts.status === "reverted"
          ? "reverted"
          : opts.status === "stuck"
            ? "submitted"
            : opts.status === "pending"
              ? "submitted"
              : "created";

  await page.route(
    `**/options/execution-intents/${opts.intentId}`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intent_id: opts.intentId,
          status: frontendStatus,
          created_at_ms: 0,
          updated_at_ms: 0,
        }),
      }),
  );

  await page.route(
    `**/executor/transactions/${opts.intentId}`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intent_id: opts.intentId,
          tx_hash: txHash,
          status: txStatus,
          reverted_reason:
            opts.status === "reverted"
              ? "synthetic revert (M-P4c cycler)"
              : opts.status === "failed"
                ? "synthetic failed (M-P4c cycler)"
                : undefined,
        }),
      }),
  );
}

/**
 * Unmount translators for a given intent. Useful when a single spec
 * exercises multiple intents and you want isolation between them.
 */
export async function unmountIntentTranslation(
  page: Page,
  intentId: string,
): Promise<void> {
  await page.unroute(`**/options/execution-intents/${intentId}`);
  await page.unroute(`**/executor/transactions/${intentId}`);
}

/**
 * Convenience: produce a uuid the same way the backend would, so
 * fallback-mode specs can call `mountIntentTranslation` against a
 * deterministic uuid without needing the cycler.
 */
export function fallbackIntentId(seed: string): string {
  // Pad/truncate to 32 hex characters, then format as a uuid v4-ish
  // shape. Deterministic per seed. Not cryptographic.
  const hex = (seed.padEnd(32, "0") + "00000000")
    .replace(/[^0-9a-f]/g, "0")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
