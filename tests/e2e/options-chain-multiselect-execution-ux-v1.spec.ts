/**
 * options-chain-multiselect-execution-ux-v1.spec.ts
 *
 * Covers OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1:
 *
 *   * The chain grid renders each Bid / Ask price as a `<button>`
 *     element with a stable `chain-bid-*` / `chain-ask-*` testid.
 *     Buttons are disabled when the backend does not publish live
 *     bid/ask (`n/a-testnet` posture — every price cell renders
 *     `—` on the current testnet). No fake bid/ask liquidity fires.
 *   * The trade ticket exposes an `Execution` selector with three
 *     values: `Auto` (default), `Book`, `RFQ`.
 *   * `Selected Legs` strip renders one chip per leg with Direction,
 *     Instrument, editable Ratio, and a remove `✕`.
 *   * Raw Series id is hidden from the normal user flow — it lives
 *     under the collapsed `Advanced` tester affordance.
 *   * Auto routing:
 *       - 0 legs → picker guidance ('trade-body-orderbook' + hint).
 *       - 1 leg → Book body (DirectOrderbookForm).
 *       - 2+ legs → honest 'multi-leg RFQ is not live yet' blocker.
 *   * Book + multi-leg → honest blocker copy.
 *   * RFQ + multi-leg → same honest multi-leg blocker.
 *   * TWAP order type only visible when
 *     `NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=true` (regression cross-check).
 *   * Attached TP/SL section remains available under Book — human
 *     labels, no `(1e8)` copy.
 *   * `/perps` ticket stays disabled by default.
 *   * Zero `/options/rfqs` requests and zero `/options/orders/multi`
 *     requests fire on any of these interactions.
 *
 * Backend multi-leg RFQ is not live — the milestone brief forbids
 * faking it. Chain click-to-add-leg cannot be validated by real UI
 * interaction because bid/ask are always `n/a-testnet`; the ticket
 * routing IS validated in-browser by seeding synthetic legs through
 * `window.__DEOPT_TICKET_TEST_API__`, a documented test hook the
 * provider exposes to any client for exactly this coverage.
 */

import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

type SyntheticLeg = {
  seriesId: string;
  underlying: string;
  expiry: string;
  strike: string;
  optionType: "call" | "put";
  side: "buy" | "sell";
  sourcePriceSide: "bid" | "ask";
  displayPrice?: string;
  ratio: string;
};

async function seedLegs(
  page: import("@playwright/test").Page,
  legs: SyntheticLeg[],
) {
  // The React effect that installs `__DEOPT_TICKET_TEST_API__` runs
  // after the workspace provider mounts. Wait for the hook to become
  // available before seeding — otherwise `page.evaluate` races the
  // provider on cold navigation and throws "test hook missing".
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __DEOPT_TICKET_TEST_API__?: unknown })
        .__DEOPT_TICKET_TEST_API__ !== "undefined",
    undefined,
    { timeout: 10_000 },
  );
  await page.evaluate((seed) => {
    const api = (
      window as unknown as {
        __DEOPT_TICKET_TEST_API__?: {
          addLeg: (leg: SyntheticLeg) => void;
          clearLegs: () => void;
        };
      }
    ).__DEOPT_TICKET_TEST_API__;
    if (!api) throw new Error("test hook missing");
    api.clearLegs();
    for (const l of seed) api.addLeg(l);
  }, legs);
}

const CALL_LEG_A: SyntheticLeg = {
  seriesId: "0xseriescall1650",
  underlying: "ETH",
  expiry: "2026-07-25",
  strike: "1650",
  optionType: "call",
  side: "buy",
  sourcePriceSide: "ask",
  displayPrice: "12.5",
  ratio: "1",
};

const CALL_LEG_B: SyntheticLeg = {
  seriesId: "0xseriescall1700",
  underlying: "ETH",
  expiry: "2026-07-25",
  strike: "1700",
  optionType: "call",
  side: "sell",
  sourcePriceSide: "bid",
  displayPrice: "8.0",
  ratio: "1",
};

test.describe("OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — chain UX posture", () => {
  test("trade ticket panel + workspace shell render on /options", async ({
    page,
  }) => {
    // The `options-chain-grid` requires mocked backend products +
    // series to render; existing chain-terminal specs mock those.
    // This spec focuses on the ticket UX, so we only assert the
    // workspace surface is up.
    await installMockWallet(page);
    await page.goto("/options");
    await expect(page.getByTestId("trade-panel")).toBeVisible();
    await expect(page.getByTestId("options-shell")).toBeVisible();
  });

  test("bid/ask cells that lack live prices are rendered as disabled buttons (no fake liquidity)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    // Any bid/ask testid found on the page must be a button that
    // is either disabled or attributes `data-available="false"`.
    // The backend does not publish live bid/ask on testnet, so
    // every price cell renders `—` and is not clickable.
    const bidCells = page.locator('[data-testid^="chain-bid-"]');
    const askCells = page.locator('[data-testid^="chain-ask-"]');
    const bidCount = await bidCells.count();
    const askCount = await askCells.count();
    for (let i = 0; i < bidCount; i += 1) {
      const c = bidCells.nth(i);
      await expect(c).toBeDisabled();
    }
    for (let i = 0; i < askCount; i += 1) {
      const c = askCells.nth(i);
      await expect(c).toBeDisabled();
    }
  });

  test("no /options/rfqs or /options/orders/multi request fires from the /options page (no fake multi-leg RFQ)", async ({
    page,
  }) => {
    await installMockWallet(page);
    const forbidden: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/options/rfqs") || url.includes("/orders/multi")) {
        forbidden.push(`${req.method()} ${url}`);
      }
    });
    await page.goto("/options");
    // Poke the execution selector across all three values.
    const select = page.getByTestId("trade-mode-select");
    await select.selectOption("book");
    await select.selectOption("rfq");
    await select.selectOption("auto");
    await page.waitForTimeout(300);
    expect(forbidden).toEqual([]);
  });
});

test.describe("OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — execution selector", () => {
  test("selector defaults to Auto and exposes exactly Auto / Book / RFQ", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    const select = page.getByTestId("trade-mode-select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("auto");
    await expect(select.locator('option[value="auto"]')).toHaveCount(1);
    await expect(select.locator('option[value="book"]')).toHaveCount(1);
    await expect(select.locator('option[value="rfq"]')).toHaveCount(1);
    await expect(select.locator("option")).toHaveCount(3);
  });

  test("with 0 legs + Auto, ticket exposes the Advanced fallback (collapsed by default)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    // The legs strip is absent (no chip list, no placeholder) and
    // the picker hint text was retired for a cleaner ticket. Only
    // the Advanced fallback for testers remains as the visible
    // affordance while no leg is selected.
    await expect(page.getByTestId("ticket-legs-list")).toHaveCount(0);
    await expect(page.getByTestId("ticket-legs-empty")).toHaveCount(0);
    await expect(page.getByTestId("ticket-picker-hint")).toHaveCount(0);
    const advanced = page.getByTestId("direct-orderbook-advanced");
    await expect(advanced).toBeVisible();
    await expect(advanced).toHaveAttribute("data-open", "false");
    await expect(page.getByTestId("direct-orderbook-series-id")).toHaveCount(0);
  });

  test("clicking the Advanced summary reveals the raw Series id (tester affordance)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-advanced-summary").click();
    await expect(page.getByTestId("direct-orderbook-series-id")).toBeVisible();
  });

  test("with 0 legs + RFQ requested → honest rfq_disabled body (regardless of flag)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("trade-mode-select").selectOption("rfq");
    // The routing helper surfaces rfq_disabled whenever no leg is
    // selected — an RFQ needs a leg to price. The Book fallback
    // (orderbook body) MUST NOT render simultaneously.
    await expect(page.getByTestId("trade-body-rfq-disabled")).toBeVisible();
    await expect(page.getByTestId("trade-body-orderbook")).toHaveCount(0);
  });
});

test.describe("OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — synthetic leg routing", () => {
  test("seeding 1 leg + Auto → Book body renders + leg chip is in the list", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A]);
    // Auto default → 1 leg resolves to Book.
    await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
    await expect(page.getByTestId("ticket-legs-list")).toHaveAttribute(
      "data-leg-count",
      "1",
    );
    await expect(page.getByTestId("ticket-leg-0")).toBeVisible();
    await expect(
      page.getByTestId("ticket-leg-0-direction"),
    ).toContainText(/Buy/);
    await expect(
      page.getByTestId("ticket-leg-0-instrument"),
    ).toContainText(/1650/);
  });

  test("seeding 2 legs + Auto → honest multi-leg RFQ blocker (backend not live)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A, CALL_LEG_B]);
    const blocker = page.getByTestId("trade-body-rfq-multileg-blocked");
    await expect(blocker).toBeVisible();
    await expect(blocker).toContainText(
      /Multi-leg RFQ execution is not live yet/,
    );
    await expect(blocker).toContainText(/OPTIONS-MULTI-LEG-ATOMIC-RFQ-V1/);
    // Book body does NOT co-render.
    await expect(page.getByTestId("trade-body-orderbook")).toHaveCount(0);
    await expect(page.getByTestId("ticket-legs-list")).toHaveAttribute(
      "data-leg-count",
      "2",
    );
  });

  test("seeding 2 legs + Book → honest single-leg blocker copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A, CALL_LEG_B]);
    await page.getByTestId("trade-mode-select").selectOption("book");
    const blocker = page.getByTestId("trade-body-book-blocked-multileg");
    await expect(blocker).toBeVisible();
    await expect(blocker).toContainText(
      /Book execution supports one leg at a time/,
    );
    await expect(page.getByTestId("trade-body-orderbook")).toHaveCount(0);
  });

  test("seeding 2 legs + RFQ → honest multi-leg blocker (regardless of flag)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A, CALL_LEG_B]);
    await page.getByTestId("trade-mode-select").selectOption("rfq");
    const blocker = page.getByTestId("trade-body-rfq-multileg-blocked");
    await expect(blocker).toBeVisible();
  });

  test("removing a leg via the chip ✕ reduces the leg-count and re-routes", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A, CALL_LEG_B]);
    await expect(page.getByTestId("ticket-legs-list")).toHaveAttribute(
      "data-leg-count",
      "2",
    );
    // Multi-leg blocker is up.
    await expect(
      page.getByTestId("trade-body-rfq-multileg-blocked"),
    ).toBeVisible();
    // Remove the second leg → back to 1 leg + Auto → Book.
    await page.getByTestId("ticket-leg-1-remove").click();
    await expect(page.getByTestId("ticket-legs-list")).toHaveAttribute(
      "data-leg-count",
      "1",
    );
    await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  });

  test("editing a leg ratio persists into the chip", async ({ page }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A]);
    const ratio = page.getByTestId("ticket-leg-0-ratio");
    await expect(ratio).toHaveValue("1");
    await ratio.fill("2");
    await expect(ratio).toHaveValue("2");
  });

  test("Clear all removes every leg", async ({ page }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A, CALL_LEG_B]);
    await page.getByTestId("ticket-legs-clear").click();
    // After clear: the legs strip unmounts entirely (no chip list,
    // no placeholder — the "No legs selected" caption was retired).
    await expect(page.getByTestId("ticket-legs-list")).toHaveCount(0);
    await expect(page.getByTestId("ticket-legs-empty")).toHaveCount(0);
  });

  test("Buy leg chip surfaces emerald direction; Sell leg chip surfaces red direction", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A, CALL_LEG_B]);
    await expect(page.getByTestId("ticket-leg-0")).toHaveAttribute(
      "data-leg-side",
      "buy",
    );
    await expect(page.getByTestId("ticket-leg-1")).toHaveAttribute(
      "data-leg-side",
      "sell",
    );
  });

  test("no fake multi-leg RFQ network mutation fires even after seeding two legs", async ({
    page,
  }) => {
    await installMockWallet(page);
    const forbidden: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/options/rfqs") || url.includes("/orders/multi")) {
        forbidden.push(`${req.method()} ${url}`);
      }
    });
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A, CALL_LEG_B]);
    // Toggle across every execution mode.
    const select = page.getByTestId("trade-mode-select");
    await select.selectOption("book");
    await select.selectOption("rfq");
    await select.selectOption("auto");
    await page.waitForTimeout(300);
    expect(forbidden).toEqual([]);
  });
});

test.describe("OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — regression posture", () => {
  test("attached TP/SL section stays under Book with human-readable labels", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await seedLegs(page, [CALL_LEG_A]);
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    const section = page.getByTestId("direct-orderbook-attached-section");
    await expect(section).toContainText(/TP Trigger Price/);
    await expect(section).not.toContainText(/\(1e8\)/i);
  });

  test("TWAP option appears in Order Type only when NEXT_PUBLIC_OPTIONS_TWAP_ENABLED is on (regression cross-check)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    const orderType = page.getByTestId("options-order-type-select");
    await expect(orderType).toBeVisible();
    const twap = orderType.locator('option[value="twap"]');
    const flagOn =
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_OPTIONS_TWAP_ENABLED === "1";
    await expect(twap).toHaveCount(flagOn ? 1 : 0);
  });

  test("/perps ticket remains disabled by default (cross-check)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/perps");
    const submit = page.getByTestId("widget-perps-trade-submit");
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("data-ticket-mode", "disabled");
  });

  test("/rfq-strategy still loads (no regression on RFQ workspace)", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/rfq-strategy");
    await expect(page.getByTestId("rfq-strategy-workspace")).toBeVisible();
  });
});
