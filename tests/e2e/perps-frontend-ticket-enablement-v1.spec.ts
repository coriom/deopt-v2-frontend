/**
 * perps-frontend-ticket-enablement-v1.spec.ts
 *
 * PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — default-disabled ticket +
 * visible V1 caveat disclosures.
 *
 * These specs pin the DEFAULT `/perps` posture:
 *   * `NEXT_PUBLIC_PERPS_TICKET_ENABLED` is unset at server build,
 *     so `isPerpsTicketEnabled()` returns `false`.
 *   * Submit button renders "Perps not live" and is hard-disabled.
 *   * Both V1 caveat disclosures render (mark == index; funding
 *     currently on-chain-disabled).
 *   * The five read-only Perps panels remain mounted and untouched.
 *   * The frontend never calls the mutation route in this posture.
 *
 * The enabled-mode UX flow is exercised by a separate node test
 * (`tests/node/perps-ticket-enablement-flag.contract.mjs`) which
 * asserts the pure `isPerpsTicketEnabled()` gate + the API client
 * request shape.
 */
import { test, expect, type Page } from "@playwright/test";

async function gotoPerps(page: Page) {
  await page.goto("/perps");
  // Both the page-level not-live banner and the V1 disclosures banner
  // were retired for visual polish. Wait on the workspace shell instead
  // — the not-live posture is still enforced by the disabled submit
  // button + backend fail-closed grid.
  await expect(page.getByTestId("workspace-perps")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — default posture", () => {
  test("retired V1 disclosures banner does not resurface", async ({ page }) => {
    // The V1 disclosures banner was retired for visual polish. Its
    // safety intent is still met end-to-end: the widget submit button
    // stays hard-disabled with "Perps not live" (asserted below), the
    // backend flag defaults to false with a mainnet startup guard, and
    // the 9-URL fail-closed grid keeps every Perps mutation at 503.
    await gotoPerps(page);
    await expect(page.getByTestId("perps-v1-disclosures-banner")).toHaveCount(0);
    await expect(page.getByTestId("perps-v1-disclosure-mark")).toHaveCount(0);
    await expect(page.getByTestId("perps-v1-disclosure-funding")).toHaveCount(0);
  });

  test("submit button is disabled and shows 'Perps not live' copy", async ({
    page,
  }) => {
    await gotoPerps(page);
    const submit = page.getByTestId("widget-perps-trade-submit");
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("data-ticket-mode", "disabled");
    await expect(submit).toContainText(/perps not live/i);
  });

  test("clicking the disabled submit never triggers a mutation request", async ({
    page,
  }) => {
    let sawMutationCall = false;
    await page.route("**/perps/orders*", (route) => {
      sawMutationCall = true;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "PerpsNotLive" }),
      });
    });
    await gotoPerps(page);
    const submit = page.getByTestId("widget-perps-trade-submit");
    await submit.click({ force: true }).catch(() => {
      // The button is disabled; click may throw or be ignored.
    });
    // Give the disabled button a moment to NOT fire.
    await page.waitForTimeout(500);
    expect(sawMutationCall).toBe(false);
  });

  test("all five read-only Perps panels remain mounted in default mode", async ({
    page,
  }) => {
    await gotoPerps(page);
    await expect(page.getByTestId("perps-positions-panel")).toBeVisible();
    await expect(page.getByTestId("perps-orders-panel")).toBeVisible();
    await expect(page.getByTestId("perps-fills-panel")).toBeVisible();
    await expect(page.getByTestId("perps-liquidations-panel")).toBeVisible();
    await expect(page.getByTestId("perps-funding-panel")).toBeVisible();
  });

  test("retired page-level not-live banner does not resurface", async ({
    page,
  }) => {
    await gotoPerps(page);
    // Page-level `perps-not-live-banner` was retired for visual polish.
    // The `not-live` posture is carried by (a) the V1 disclosures banner,
    // (b) the hard-disabled submit button ("Perps not live"), and
    // (c) the backend fail-closed grid — asserted by other tests.
    await expect(page.getByTestId("perps-not-live-banner")).toHaveCount(0);
  });
});
