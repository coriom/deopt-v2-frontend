/**
 * tx-status-cycler.spec.ts — M-P4d
 *
 * Dual-mode tx-status timeline coverage. When the backend M-P4c
 * fixture is reachable, specs create a synthetic intent + drive its
 * status via the cycler, and the page-route translator surfaces the
 * resulting state to the production polling hook. When the cycler is
 * unreachable, the same specs fall back to pure synthetic state via
 * `mountIntentTranslation` — no backend required.
 *
 * Every spec is hardened against the following:
 *   * No `Authorization` header reaches the trading UI runtime.
 *   * No `/admin/test/*` URL is ever fetched from the browser app.
 *   * No real broadcast, no real signer, no real wallet.
 *   * The synthetic tx hash carries the `0xdeadbee5` marker.
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  ANVIL_CHAIN_ID,
} from "./wallet-fixture";
import {
  probeBackendFixture,
  createSyntheticIntent,
  transitionSyntheticIntent,
  mountIntentTranslation,
  fallbackIntentId,
  type BackendFixtureStatus,
} from "./backend-fixture";

interface ScenarioContext {
  intentId: string;
  mode: "fixture" | "fallback";
  status: BackendFixtureStatus;
}

/**
 * Drive the backend fixture (if reachable) OR build a synthetic intent
 * (fallback) into the requested target status, then mount the
 * page-route translators so the production polling hook sees the
 * expected wire shape. Returns the intent id + the active mode so the
 * spec can include it in the test log.
 */
async function setupScenario(
  request: import("@playwright/test").APIRequestContext,
  page: import("@playwright/test").Page,
  scenarioName: string,
  targetStatus: BackendFixtureStatus,
): Promise<ScenarioContext> {
  const probe = await probeBackendFixture(request);

  let intentId: string;
  let mode: "fixture" | "fallback";

  if (probe.mode === "fixture") {
    const created = await createSyntheticIntent(request, probe.backendUrl, {
      account: DEFAULT_TEST_ACCOUNT,
    });
    intentId = created.intent_id;
    mode = "fixture";

    // Walk the cycler to the target status.
    if (targetStatus !== "created") {
      await transitionSyntheticIntent(
        request,
        probe.backendUrl,
        intentId,
        "pending",
      );
    }
    if (
      targetStatus === "confirmed" ||
      targetStatus === "failed" ||
      targetStatus === "reverted" ||
      targetStatus === "stuck"
    ) {
      await transitionSyntheticIntent(
        request,
        probe.backendUrl,
        intentId,
        targetStatus,
      );
    }
  } else {
    intentId = fallbackIntentId(scenarioName);
    mode = "fallback";
    console.log(
      `[${scenarioName}] FALLBACK MODE (${probe.fallbackReason ?? "no backend"})`,
    );
  }

  await mountIntentTranslation(page, { intentId, status: targetStatus });
  return { intentId, mode, status: targetStatus };
}

/** Sanity helper — fails the test if any authorization header reaches
 * the app runtime during navigation. */
async function assertNoAdminBearer(
  page: import("@playwright/test").Page,
): Promise<() => void> {
  const seenAuth: string[] = [];
  const seenAdminUrl: string[] = [];

  const requestHandler = (req: import("@playwright/test").Request) => {
    const url = req.url();
    const auth = req.headers()["authorization"];
    if (auth) seenAuth.push(`${url} :: ${auth.slice(0, 8)}…`);
    if (url.includes("/admin/test/")) seenAdminUrl.push(url);
  };

  page.on("request", requestHandler);
  return () => {
    page.off("request", requestHandler);
    expect(
      seenAuth,
      "trading UI must NEVER attach an Authorization header to any XHR",
    ).toEqual([]);
    expect(
      seenAdminUrl,
      "trading UI must NEVER fetch /admin/test/* — those are Playwright-side only",
    ).toEqual([]);
  };
}

test.describe("tx-status timeline (M-P4d dual-mode)", () => {
  test("CREATED renders the first stage", async ({ page, request }) => {
    await installMockWallet(page, {
      account: DEFAULT_TEST_ACCOUNT,
      chainId: ANVIL_CHAIN_ID,
    });
    const flush = await assertNoAdminBearer(page);
    const ctx = await setupScenario(request, page, "created", "created");

    await page.goto(`/transactions/${ctx.intentId}`);
    await expect(page.getByText(/Transaction/i).first()).toBeVisible();
    await expect(page.getByText("CREATED").first()).toBeVisible();
    await expect(page.getByText(ctx.intentId)).toBeVisible();
    flush();
  });

  test("PENDING surfaces a synthetic tx hash with deadbee5 marker", async ({
    page,
    request,
  }) => {
    await installMockWallet(page, {
      account: DEFAULT_TEST_ACCOUNT,
      chainId: ANVIL_CHAIN_ID,
    });
    const flush = await assertNoAdminBearer(page);
    const ctx = await setupScenario(request, page, "pending", "pending");

    await page.goto(`/transactions/${ctx.intentId}`);
    // BROADCAST stage is rendered when status === "BROADCAST".
    await expect(page.getByText("BROADCAST").first()).toBeVisible();
    await expect(page.getByText(/0xdeadbee5/)).toBeVisible();
    flush();
  });

  test("CONFIRMED renders the terminal stage", async ({ page, request }) => {
    await installMockWallet(page, {
      account: DEFAULT_TEST_ACCOUNT,
      chainId: ANVIL_CHAIN_ID,
    });
    const flush = await assertNoAdminBearer(page);
    const ctx = await setupScenario(request, page, "confirmed", "confirmed");

    await page.goto(`/transactions/${ctx.intentId}`);
    await expect(page.getByText("CONFIRMED").first()).toBeVisible();
    flush();
  });

  test("FAILED surfaces the REVERTED banner with a synthetic reason", async ({
    page,
    request,
  }) => {
    await installMockWallet(page, {
      account: DEFAULT_TEST_ACCOUNT,
      chainId: ANVIL_CHAIN_ID,
    });
    const flush = await assertNoAdminBearer(page);
    const ctx = await setupScenario(request, page, "failed", "failed");

    await page.goto(`/transactions/${ctx.intentId}`);
    await expect(page.getByText(/REVERTED/i).first()).toBeVisible();
    await expect(page.getByText(/synthetic failed/i)).toBeVisible();
    flush();
  });

  test("REVERTED surfaces the REVERTED banner with the revert reason", async ({
    page,
    request,
  }) => {
    await installMockWallet(page, {
      account: DEFAULT_TEST_ACCOUNT,
      chainId: ANVIL_CHAIN_ID,
    });
    const flush = await assertNoAdminBearer(page);
    const ctx = await setupScenario(request, page, "reverted", "reverted");

    await page.goto(`/transactions/${ctx.intentId}`);
    await expect(page.getByText(/REVERTED/i).first()).toBeVisible();
    await expect(page.getByText(/synthetic revert/i)).toBeVisible();
    flush();
  });

  test("STUCK surfaces the operator-review banner", async ({
    page,
    request,
  }) => {
    await installMockWallet(page, {
      account: DEFAULT_TEST_ACCOUNT,
      chainId: ANVIL_CHAIN_ID,
    });
    const flush = await assertNoAdminBearer(page);
    const ctx = await setupScenario(request, page, "stuck", "stuck");

    await page.goto(`/transactions/${ctx.intentId}`);
    await expect(page.getByText(/STUCK/i).first()).toBeVisible();
    await expect(page.getByText(/operator review pending/i)).toBeVisible();
    flush();
  });

  test("unknown intent id still renders the timeline (CREATED default)", async ({
    page,
  }) => {
    await installMockWallet(page);
    // No backend setup, no translator — exercise the hook's null-data
    // path, which TxStatusTimeline renders as CREATED.
    await page.goto("/transactions/unknown-intent-id-xyz");
    await expect(page.getByText(/Transaction/i).first()).toBeVisible();
    await expect(page.getByText("CREATED").first()).toBeVisible();
    await expect(page.getByText("unknown-intent-id-xyz")).toBeVisible();
  });

  test("fallback mode works without a reachable backend cycler", async ({
    page,
  }) => {
    await installMockWallet(page, {
      account: DEFAULT_TEST_ACCOUNT,
      chainId: ANVIL_CHAIN_ID,
    });
    // Skip the probe — force-mount synthetic state. Proves the dual-mode
    // pattern still delivers the same UI behaviour when the cycler is
    // not running.
    const intentId = fallbackIntentId("forced-fallback");
    await mountIntentTranslation(page, { intentId, status: "confirmed" });
    await page.goto(`/transactions/${intentId}`);
    await expect(page.getByText("CONFIRMED").first()).toBeVisible();
    await expect(page.getByText(/0xdeadbee5/)).toBeVisible();
  });
});
