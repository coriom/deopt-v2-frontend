/**
 * options-advanced-order-ticket-ux-v1.spec.ts
 *
 * Covers OPTIONS-ADVANCED-ORDER-TICKET-UX-V1:
 *
 *   * The Options ticket exposes an `Order Type` dropdown. It
 *     always lists `Limit` and an honest disabled `Stop Limit`
 *     option, and lists `TWAP` only when
 *     `NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=true`.
 *   * Attached TP/SL labels no longer say `(1e8)`. Validation copy
 *     is human-readable: `"must be greater than 0"`, `"must be a
 *     valid price"`.
 *   * `Post` + `TIF` controls only appear under `Limit`.
 *   * `Reduce` control is not exposed on the base ticket.
 *   * `Stop Limit` renders the honest-disabled body with a
 *     forward-milestone reference.
 *   * TWAP body renders inside the Order Type dropdown, not as a
 *     separate ticket mode.
 *   * No fake fee / margin numbers on the preview panel.
 *   * Perps ticket remains disabled by default.
 *
 * End-to-end submit coverage (wire-shape assertions for TP/SL 1e8
 * scaling, post+IOC/FOK rejection) was removed with the
 * tester-only Advanced series id fallback — chain-click is the
 * only path to seed a leg into the DirectOrderbookForm now.
 */

import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test.describe("OPTIONS-ADVANCED-ORDER-TICKET-UX-V1 — Order Type dropdown", () => {
  test("Order Type dropdown exposes Limit and Stop Limit; TWAP only when flag on", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    const select = page.getByTestId("options-order-type-select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("limit");
    await expect(
      select.locator('option[value="limit"]'),
    ).toHaveCount(1);
    await expect(
      select.locator('option[value="stop_limit"]'),
    ).toHaveCount(1);
    // TWAP presence gated on env — the spec runs under both.
    const twapOption = select.locator('option[value="twap"]');
    const flagOn =
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "1";
    await expect(twapOption).toHaveCount(flagOn ? 1 : 0);
  });

  test("Stop Limit renders honest-disabled body with milestone reference; no submit path", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    const select = page.getByTestId("options-order-type-select");
    await select.selectOption("stop_limit");
    const disabled = page.getByTestId("options-stop-limit-disabled");
    await expect(disabled).toBeVisible();
    await expect(disabled).toContainText(/Stop Limit is not live yet/);
    await expect(disabled).toContainText(/OPTIONS-STOP-LIMIT-ORDERS-V1/);
    // Limit body must NOT render simultaneously.
    await expect(
      page.getByTestId("options-order-type-body-limit"),
    ).toHaveCount(0);
    // Submit button must NOT render under Stop Limit.
    await expect(
      page.getByTestId("direct-orderbook-submit"),
    ).toHaveCount(0);
  });

  test("Limit body carries Post + TIF; Stop Limit body does not", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    const select = page.getByTestId("options-order-type-select");
    await expect(page.getByTestId("direct-orderbook-tif-row")).toBeVisible();
    await select.selectOption("stop_limit");
    await expect(page.getByTestId("direct-orderbook-tif-row")).toHaveCount(0);
    await select.selectOption("limit");
    await expect(page.getByTestId("direct-orderbook-tif-row")).toBeVisible();
  });

  test("no Reduce checkbox on the base Options ticket (unsupported by backend)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    // The ticket must not surface a Reduce control — the backend
    // does not expose reduce-only on the base option order DTO.
    await expect(
      page.getByRole("checkbox", { name: /reduce/i }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("direct-orderbook-reduce-only"),
    ).toHaveCount(0);
  });
});

test.describe("OPTIONS-TRADE-WIDGET-TP-SL-UX-V1 — Attached TP/SL simplified inputs", () => {
  test("labels expose a single per-side price ('Take Profit Price' / 'Stop Loss Price') and never contain '(1e8)'", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    // Attached section always renders; open both legs to make
    // every price label visible.
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    const section = page.getByTestId("direct-orderbook-attached-section");
    await expect(section).not.toContainText(/\(1e8\)/i);
    await expect(section).toContainText(/Take Profit Price/);
    await expect(section).toContainText(/Stop Loss Price/);
    // Legacy 4-field labels must NOT appear.
    await expect(section).not.toContainText(/TP Trigger Price/);
    await expect(section).not.toContainText(/TP Limit Price/);
    await expect(section).not.toContainText(/SL Trigger Price/);
    await expect(section).not.toContainText(/SL Limit Price/);
    // The old trigger/limit inputs must be gone.
    await expect(
      page.getByTestId("direct-orderbook-attach-tp-trigger"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("direct-orderbook-attach-tp-limit"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("direct-orderbook-attach-sl-trigger"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("direct-orderbook-attach-sl-limit"),
    ).toHaveCount(0);
  });

  test("empty Take Profit stays quiet; invalid input surfaces human-readable copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    const err = page.getByTestId("direct-orderbook-attach-tp-error");
    // Empty field → no message rendered. Submit is still blocked by
    // validation.ok internally; we don't shout "required" at a user
    // who just toggled the checkbox.
    await expect(err).toHaveCount(0);
    // Typing an invalid value surfaces the friendly copy, never the
    // wire-scale ("1e8") vocabulary.
    await page.getByTestId("direct-orderbook-attach-tp-price").fill("abc");
    await expect(err).toContainText(/valid price/);
    await expect(err).not.toContainText(/1e8/i);
  });

  test("empty Stop Loss stays quiet; invalid input surfaces human-readable copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    const err = page.getByTestId("direct-orderbook-attach-sl-error");
    await expect(err).toHaveCount(0);
    await page.getByTestId("direct-orderbook-attach-sl-price").fill("abc");
    await expect(err).toContainText(/valid price/);
    await expect(err).not.toContainText(/1e8/i);
  });

  test("zero Take Profit price surfaces the 'greater than 0' copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-tp-price").fill("0");
    await expect(
      page.getByTestId("direct-orderbook-attach-tp-error"),
    ).toContainText(/must be greater than 0/);
  });

  test("non-decimal Stop Loss price surfaces the 'valid price' copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-price").fill("abc");
    await expect(
      page.getByTestId("direct-orderbook-attach-sl-error"),
    ).toContainText(/must be a valid price/);
  });

  test("TP+SL enabled renders plain-English OCO copy explaining automatic linkage", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page.getByTestId("direct-orderbook-attach-tp-price").fill("15");
    await page.getByTestId("direct-orderbook-attach-sl-price").fill("5");
    await expect(
      page.getByTestId("direct-orderbook-attach-oco-copy"),
    ).toContainText(
      /Take Profit and Stop Loss are linked automatically\. When one fills, the other is cancelled\./,
    );
    // The bare acronym "OCO on" must NOT appear.
    await expect(
      page.getByTestId("direct-orderbook-attach-oco-copy"),
    ).not.toHaveText(/^OCO on\.?$/);
  });
});

test.describe("OPTIONS-ADVANCED-ORDER-TICKET-UX-V1 — honesty & regression posture", () => {
  test("no fake fee / margin / rewards numbers appear in the ticket by default", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    // The main ticket must not fabricate any of these — the honest
    // preview lives in the TWAP form and renders `—` for values
    // the backend does not yet expose.
    const panel = page.getByTestId("trade-panel");
    await expect(panel).not.toContainText(/Est\. Total Fee \$\d/);
    await expect(panel).not.toContainText(/Margin Required: \$\d/);
    await expect(panel).not.toContainText(/Buying Power: \$\d/);
    await expect(panel).not.toContainText(/Est\. Rewards \$\d/);
  });

  test("Perps ticket remains disabled by default (cross-check)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/perps");
    const submit = page.getByTestId("widget-perps-trade-submit");
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("data-ticket-mode", "disabled");
  });

  test("selecting TWAP order type renders the OptionsTwapForm inline (flag-on only)", async ({
    page,
  }) => {
    const flagOn =
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "1";
    test.skip(!flagOn, "Requires NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=true");
    await installMockWallet(page);
    await page.goto("/options");
    const select = page.getByTestId("options-order-type-select");
    await select.selectOption("twap");
    await expect(
      page.getByTestId("options-order-type-body-twap"),
    ).toBeVisible();
    await expect(page.getByTestId("options-twap-form")).toBeVisible();
    // Limit body must not co-render.
    await expect(
      page.getByTestId("options-order-type-body-limit"),
    ).toHaveCount(0);
  });

  test("TWAP form labels swap Max Price ↔ Min Price on side toggle (flag-on only)", async ({
    page,
  }) => {
    const flagOn =
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "1";
    test.skip(!flagOn, "Requires NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=true");
    await installMockWallet(page);
    await page.goto("/options");
    await page
      .getByTestId("options-order-type-select")
      .selectOption("twap");
    // Buy default → "Max Price" label present.
    await expect(page.getByText(/Max Price/i).first()).toBeVisible();
    // Switch to Sell → "Min Price" label appears.
    const sellButton = page.getByTestId("options-twap-side-sell");
    const sellCount = await sellButton.count();
    if (sellCount === 1) {
      await sellButton.click();
      await expect(page.getByText(/Min Price/i).first()).toBeVisible();
    }
  });
});
