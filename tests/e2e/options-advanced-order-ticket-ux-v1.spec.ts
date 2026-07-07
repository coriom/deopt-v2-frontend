/**
 * options-advanced-order-ticket-ux-v1.spec.ts
 *
 * Covers OPTIONS-ADVANCED-ORDER-TICKET-UX-V1:
 *
 *   * The Options ticket exposes an `Order Type` dropdown. It
 *     always lists `Limit` and an honest disabled `Stop Limit`
 *     option, and lists `TWAP` only when
 *     `NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=true`.
 *   * Attached TP/SL labels no longer say `(1e8)`. Inputs accept
 *     human-readable dollar prices; the wire body still contains
 *     `trigger_price_1e8` / `limit_price_1e8` 1e8-scaled strings.
 *   * Validation copy is human-readable: `"TP trigger price is
 *     required"`, `"must be greater than 0"`, `"must be a valid
 *     price"`.
 *   * `Post` + `TIF` controls only appear under `Limit`.
 *   * `Reduce` control is not exposed on the base ticket.
 *   * `Stop Limit` renders the honest-disabled body with a
 *     forward-milestone reference.
 *   * TWAP body renders inside the Order Type dropdown, not as a
 *     separate ticket mode.
 *   * No fake fee / margin numbers on the preview panel.
 *   * Perps ticket remains disabled by default.
 *
 * The wire-shape test that sends a mocked `POST /options/orders`
 * confirms the whole "human input → 1e8 wire" conversion is
 * byte-correct end-to-end for the ticket UX.
 */

import { test, expect, type Route } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
  mockWriteAuthChallenge,
} from "./wallet-helpers";
import { installMockWallet } from "./wallet-fixture";

const SERIES_ID =
  "0x62e9de8122013ec803cddbbe018c92dd78871c68a1b37c0b9eb39bca13a5f43f";

interface WireBody {
  option_series_id: string;
  side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  time_in_force: "gtc" | "ioc" | "fok";
  post_only?: boolean;
  attached_tp_sl?: {
    take_profit?: { trigger_price_1e8: string; limit_price_1e8: string };
    stop_loss?: { trigger_price_1e8: string; limit_price_1e8: string };
    link_as_oco?: boolean;
  };
}

const FILLED_RESPONSE = {
  order_id: "order-1",
  option_series_id: SERIES_ID,
  account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  side: "buy",
  price_1e8: "1000000000",
  size_1e8: "100000000",
  remaining_size_1e8: "0",
  time_in_force: "gtc",
  post_only: false,
  client_order_id: null,
  nonce: null,
  deadline_ms: null,
  signature: null,
  status: "filled",
  created_at_ms: 1_782_000_000_000,
  updated_at_ms: 1_782_000_000_000,
  fills: [],
};

async function mockOrdersRoute(
  page: import("@playwright/test").Page,
  captured: { body: WireBody | null },
) {
  await page.route("**/options/orders", async (route: Route) => {
    const req = route.request();
    expect(req.method()).toBe("POST");
    captured.body = JSON.parse(req.postData() ?? "{}") as WireBody;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FILLED_RESPONSE),
    });
  });
}

async function gotoTicketConnected(page: import("@playwright/test").Page) {
  await installConnectedWallet(page);
  await mockWriteAuthChallenge(page);
  await page.goto("/options");
  await connectWallet(page);
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-form")).toBeVisible();
}

async function fillBase(page: import("@playwright/test").Page) {
  // OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — series id is hidden
  // behind the Advanced tester affordance; open it first.
  await page.getByTestId("direct-orderbook-advanced-summary").click();
  await page.getByTestId("direct-orderbook-series-id").fill(SERIES_ID);
  await page
    .getByTestId("direct-orderbook-account")
    .fill("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  // Limit Price + Amount default to empty placeholder `0.0` — fill
  // them so `canSubmit` is satisfied.
  await page.getByTestId("direct-orderbook-price").fill("1000000000");
  await page.getByTestId("direct-orderbook-size").fill("100000000");
}

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

test.describe("OPTIONS-ADVANCED-ORDER-TICKET-UX-V1 — Attached TP/SL human prices", () => {
  test("labels never contain '(1e8)' when TP/SL are enabled", async ({
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
    await expect(section).toContainText(/TP Trigger Price/);
    await expect(section).toContainText(/TP Limit Price/);
    await expect(section).toContainText(/SL Trigger Price/);
    await expect(section).toContainText(/SL Limit Price/);
  });

  test("human prices convert to 1e8 on wire; TP-only submit sends the canonical 1e8 body", async ({
    page,
  }) => {
    const captured = { body: null as WireBody | null };
    await mockOrdersRoute(page, captured);
    await gotoTicketConnected(page);
    await fillBase(page);
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page
      .getByTestId("direct-orderbook-attach-tp-trigger")
      .fill("189.1");
    await page.getByTestId("direct-orderbook-attach-tp-limit").fill("250");
    await page.getByTestId("direct-orderbook-submit").click();
    await expect(
      page.getByTestId("direct-orderbook-result-status"),
    ).toBeVisible();
    expect(captured.body?.attached_tp_sl).toEqual({
      take_profit: {
        trigger_price_1e8: "18910000000",
        limit_price_1e8: "25000000000",
      },
    });
  });

  test("missing TP trigger surfaces human-readable validation copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-tp-limit").fill("15");
    const err = page.getByTestId("direct-orderbook-attach-tp-trigger-error");
    await expect(err).toContainText(/TP trigger price is required/);
    await expect(err).not.toContainText(/1e8/i);
  });

  test("missing TP limit surfaces human-readable validation copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-tp-trigger").fill("15");
    const err = page.getByTestId("direct-orderbook-attach-tp-limit-error");
    await expect(err).toContainText(/TP limit price is required/);
    await expect(err).not.toContainText(/1e8/i);
  });

  test("missing SL trigger surfaces human-readable validation copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-limit").fill("5");
    const err = page.getByTestId("direct-orderbook-attach-sl-trigger-error");
    await expect(err).toContainText(/SL trigger price is required/);
    await expect(err).not.toContainText(/1e8/i);
  });

  test("missing SL limit surfaces human-readable validation copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-trigger").fill("5");
    const err = page.getByTestId("direct-orderbook-attach-sl-limit-error");
    await expect(err).toContainText(/SL limit price is required/);
    await expect(err).not.toContainText(/1e8/i);
  });

  test("zero-price trigger surfaces the 'greater than 0' copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-tp-trigger").fill("0");
    await page.getByTestId("direct-orderbook-attach-tp-limit").fill("15");
    await expect(
      page.getByTestId("direct-orderbook-attach-tp-trigger-error"),
    ).toContainText(/must be greater than 0/);
  });

  test("non-decimal input surfaces the 'valid price' copy", async ({
    page,
  }) => {
    await installMockWallet(page);
    await page.goto("/options");
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-trigger").fill("abc");
    await page.getByTestId("direct-orderbook-attach-sl-limit").fill("5");
    await expect(
      page.getByTestId("direct-orderbook-attach-sl-trigger-error"),
    ).toContainText(/must be a valid price/);
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

  test("Post + IOC/FOK are rejected at the backend layer (honest posture)", async ({
    page,
  }) => {
    // The current milestone did NOT add a UI-side pre-flight for
    // post-only + IOC/FOK. Backend already rejects the combo
    // (`PostOnlyWouldMatch` / matching-engine invariant). This
    // spec pins the honest posture: the client submits, the
    // backend rejects, the ticket surfaces the rejection copy.
    const captured = { body: null as WireBody | null };
    await page.route("**/options/orders", async (route: Route) => {
      captured.body = JSON.parse(route.request().postData() ?? "{}") as WireBody;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "post-only order would immediately match",
        }),
      });
    });
    await gotoTicketConnected(page);
    await fillBase(page);
    await page.getByTestId("direct-orderbook-post-checkbox").check();
    await page.getByTestId("direct-orderbook-tif-trigger").click();
    await page.getByTestId("direct-orderbook-tif-option-IOC").click();
    await page.getByTestId("direct-orderbook-submit").click();
    await expect(
      page.getByTestId("direct-orderbook-error-message"),
    ).toContainText(/post-only order would immediately match/);
    expect(captured.body?.post_only).toBe(true);
    expect(captured.body?.time_in_force).toBe("ioc");
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
