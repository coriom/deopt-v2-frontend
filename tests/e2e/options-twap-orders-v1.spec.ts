/**
 * options-twap-orders-v1.spec.ts
 *
 * Pins the default (flag-off) posture of the Options TWAP order type.
 * Under `NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=false` (the CI default):
 *
 *   - After `OPTIONS-ADVANCED-ORDER-TICKET-UX-V1`, TWAP is an
 *     `Order Type` inside the ticket (not a top-level ticket mode).
 *     The `Order Type` dropdown MUST NOT expose the TWAP option
 *     when the flag is off.
 *   - The top-level `trade-mode-select` never carries a TWAP option
 *     regardless of flag state (products vs. execution styles).
 *   - No `/options/twap-orders` request fires on any interaction.
 *   - `OptionsTwapForm` never mounts.
 *   - Existing orderbook + RFQ modes are unchanged.
 *
 * Flag-on wiring (canonical byte freeze + form field IDs) is
 * validated by the node contract test
 * `tests/node/options-twap-canonical.contract.mjs` and by the backend
 * `twap_*` tests in `tests/options_tests.rs`. The flag-on wiring of
 * the Order Type dropdown is covered by
 * `tests/e2e/options-advanced-order-ticket-ux-v1.spec.ts`.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default build: TWAP option is absent from the trade mode dropdown", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  const select = page.getByTestId("trade-mode-select");
  await expect(select).toBeVisible();
  // The dropdown must NOT contain the TWAP option value.
  const twapOption = select.locator('option[value="twap"]');
  await expect(twapOption).toHaveCount(0);
});

test("default build: no /options/twap-orders requests fire on any interaction", async ({
  page,
}) => {
  await installMockWallet(page);
  const twapCalls: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/options/twap-orders") || url.includes("/twap/tick")) {
      twapCalls.push(`${req.method()} ${url}`);
    }
  });
  await page.goto("/options");
  const select = page.getByTestId("trade-mode-select");
  await select.selectOption("orderbook");
  await select.selectOption("rfq");
  await select.selectOption("orderbook");
  await page.waitForTimeout(400);
  expect(twapCalls).toEqual([]);
});

test("default build: OptionsTwapForm is not mounted anywhere", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("options-twap-form")).toHaveCount(0);
  await expect(page.getByTestId("options-twap-form-disabled")).toHaveCount(0);
  await expect(page.getByTestId("options-twap-submit")).toHaveCount(0);
});

test("default build: no TWAP body renders under any dropdown selection", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  // Legacy top-level twap-mode body must never appear (removed in
  // OPTIONS-ADVANCED-ORDER-TICKET-UX-V1).
  await expect(page.getByTestId("trade-body-twap")).toHaveCount(0);
  // Order Type dropdown must NOT expose a TWAP option when the
  // flag is off.
  const orderType = page.getByTestId("options-order-type-select");
  await expect(orderType).toBeVisible();
  await expect(
    orderType.locator('option[value="twap"]'),
  ).toHaveCount(0);
  // And the flag-on TWAP body id must not be present either.
  await expect(page.getByTestId("options-order-type-body-twap")).toHaveCount(0);
});

test("default build: /options still loads (Options behavior does not regress)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("options-shell")).toBeVisible();
  await expect(page.getByTestId("trade-panel")).toBeVisible();
});

test("default build: RFQ mode still works (no TWAP regression on RFQ)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  const select = page.getByTestId("trade-mode-select");
  await select.selectOption("rfq");
  await expect(page.getByTestId("trade-body-rfq")).toBeVisible();
});

test("default build: /perps ticket remains disabled by default", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  const submit = page.getByTestId("widget-perps-trade-submit");
  await expect(submit).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("data-ticket-mode", "disabled");
});

test("default build: /rfq-strategy still loads (RFQ does not regress)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await expect(page.getByTestId("rfq-strategy-workspace")).toBeVisible();
});
