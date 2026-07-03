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
  await expect(page.getByTestId("perps-not-live-banner")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — default posture", () => {
  test("V1 disclosure banner renders both mark + funding caveats", async ({
    page,
  }) => {
    await gotoPerps(page);
    await expect(page.getByTestId("perps-v1-disclosures-banner")).toBeVisible();
    const markLine = page.getByTestId("perps-v1-disclosure-mark");
    const fundingLine = page.getByTestId("perps-v1-disclosure-funding");
    await expect(markLine).toBeVisible();
    await expect(markLine).toContainText("mark price");
    await expect(markLine).toContainText("index price");
    await expect(fundingLine).toBeVisible();
    await expect(fundingLine).toContainText("funding");
    await expect(fundingLine).toContainText("disabled");
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

  test("not-live banner still visible", async ({ page }) => {
    await gotoPerps(page);
    const banner = page.getByTestId("perps-not-live-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/not live/i);
  });
});
