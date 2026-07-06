// ATTACHED-TP-SL-TICKET-UI-V1 — Playwright coverage of the
// `/options` order ticket's attached TP/SL section. Mirrors the
// existing `orderbook-trade-widget.spec.ts` pattern:
//   * `page.route` mocks `POST /options/orders` so no backend is
//     required;
//   * the spec asserts the exact submit body the form constructs
//     under each ticket configuration (TP-only / SL-only / TP+SL
//     OCO / no-attached);
//   * UI-level checks pin the success/error copy + per-field
//     validation states.
//
// OPTIONS-ADVANCED-ORDER-TICKET-UX-V1 update: the attached TP/SL
// inputs now accept human-readable dollar prices (`"15"` for $15,
// `"5"` for $5). The wire body still contains the 1e8-scaled
// `trigger_price_1e8` / `limit_price_1e8` strings — the form
// converts on submit via `humanToScaled1e8`. Validation copy is
// also human-friendly: `"TP trigger price is required"` /
// `"must be greater than 0"` / `"must be a valid price"`.

import { test, expect, type Route } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
  mockWriteAuthChallenge,
} from "./wallet-helpers";

const SERIES_ID =
  "0x62e9de8122013ec803cddbbe018c92dd78871c68a1b37c0b9eb39bca13a5f43f";

interface Captured {
  request: SubmitBody | null;
}

interface SubmitBody {
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
  fills: [
    {
      fill_id: "fill-0",
      option_series_id: SERIES_ID,
      buy_order_id: "order-1",
      sell_order_id: "maker-0",
      buyer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      seller: "0x0000000000000000000000000000000000000002",
      maker_order_id: "maker-0",
      taker_order_id: "order-1",
      taker_side: "buy",
      price_1e8: "1000000000",
      size_1e8: "100000000",
      created_at_ms: 1_782_000_000_000,
    },
  ],
};

async function setupOrdersRoute(
  page: import("@playwright/test").Page,
  captured: Captured,
  responder: (req: SubmitBody) => { status: number; body: object } = () => ({
    status: 200,
    body: FILLED_RESPONSE,
  }),
) {
  await page.route("**/options/orders", async (route: Route) => {
    const req = route.request();
    expect(req.method()).toBe("POST");
    const body = JSON.parse(req.postData() ?? "{}") as SubmitBody;
    captured.request = body;
    const { status, body: respBody } = responder(body);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(respBody),
    });
  });
}

async function gotoTicket(page: import("@playwright/test").Page) {
  await installConnectedWallet(page);
  await mockWriteAuthChallenge(page);
  await page.goto("/options");
  await connectWallet(page);
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-form")).toBeVisible();
}

async function fillBaseTicket(page: import("@playwright/test").Page) {
  // OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — series id is hidden
  // behind the Advanced tester affordance; open it first.
  await page.getByTestId("direct-orderbook-advanced-summary").click();
  await page.getByTestId("direct-orderbook-series-id").fill(SERIES_ID);
  await page
    .getByTestId("direct-orderbook-account")
    .fill("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
}

test.describe("/options ticket — attached TP/SL", () => {
  test("attached section is present and disabled by default; default submit omits attached_tp_sl", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured);
    await gotoTicket(page);

    await expect(
      page.getByTestId("direct-orderbook-attached-section"),
    ).toBeVisible();
    // Neither toggle checked initially.
    await expect(
      page.getByTestId("direct-orderbook-attach-tp-toggle"),
    ).not.toBeChecked();
    await expect(
      page.getByTestId("direct-orderbook-attach-sl-toggle"),
    ).not.toBeChecked();
    // No inputs visible until a leg is enabled.
    await expect(
      page.getByTestId("direct-orderbook-attach-tp-trigger"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("direct-orderbook-attach-sl-trigger"),
    ).toHaveCount(0);

    await fillBaseTicket(page);
    await page.getByTestId("direct-orderbook-submit").click();
    await expect(
      page.getByTestId("direct-orderbook-result-status"),
    ).toBeVisible();
    expect(captured.request?.attached_tp_sl).toBeUndefined();
    await expect(
      page.getByTestId("direct-orderbook-result-attached"),
    ).toHaveCount(0);
  });

  test("TP-only payload is sent and success cell shows the attached pending copy", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured);
    await gotoTicket(page);
    await fillBaseTicket(page);

    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page
      .getByTestId("direct-orderbook-attach-tp-trigger")
      .fill("15");
    await page
      .getByTestId("direct-orderbook-attach-tp-limit")
      .fill("15");

    await page.getByTestId("direct-orderbook-submit").click();
    await expect(
      page.getByTestId("direct-orderbook-result-status"),
    ).toBeVisible();
    expect(captured.request?.attached_tp_sl).toEqual({
      take_profit: {
        trigger_price_1e8: "1500000000",
        limit_price_1e8: "1500000000",
      },
    });
    await expect(
      page.getByTestId("direct-orderbook-result-attached"),
    ).toContainText(/Attached TP\/SL plan submitted/);
  });

  test("SL-only payload omits take_profit and link_as_oco", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured);
    await gotoTicket(page);
    await fillBaseTicket(page);

    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page
      .getByTestId("direct-orderbook-attach-sl-trigger")
      .fill("5");
    await page
      .getByTestId("direct-orderbook-attach-sl-limit")
      .fill("5");

    await page.getByTestId("direct-orderbook-submit").click();
    await expect(
      page.getByTestId("direct-orderbook-result-status"),
    ).toBeVisible();
    expect(captured.request?.attached_tp_sl).toEqual({
      stop_loss: {
        trigger_price_1e8: "500000000",
        limit_price_1e8: "500000000",
      },
    });
    expect(captured.request?.attached_tp_sl?.link_as_oco).toBeUndefined();
  });

  test("TP+SL forces link_as_oco=true and shows the OCO copy", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured);
    await gotoTicket(page);
    await fillBaseTicket(page);

    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page
      .getByTestId("direct-orderbook-attach-tp-trigger")
      .fill("15");
    await page
      .getByTestId("direct-orderbook-attach-tp-limit")
      .fill("15");
    await page
      .getByTestId("direct-orderbook-attach-sl-trigger")
      .fill("5");
    await page
      .getByTestId("direct-orderbook-attach-sl-limit")
      .fill("5");

    await expect(
      page.getByTestId("direct-orderbook-attach-oco-copy"),
    ).toBeVisible();

    await page.getByTestId("direct-orderbook-submit").click();
    await expect(
      page.getByTestId("direct-orderbook-result-status"),
    ).toBeVisible();
    expect(captured.request?.attached_tp_sl?.link_as_oco).toBe(true);
    expect(captured.request?.attached_tp_sl?.take_profit).toBeTruthy();
    expect(captured.request?.attached_tp_sl?.stop_loss).toBeTruthy();
  });

  test("invalid TP trigger price disables submit + shows inline error", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured);
    await gotoTicket(page);
    await fillBaseTicket(page);

    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page.getByTestId("direct-orderbook-attach-tp-trigger").fill("0");
    await page.getByTestId("direct-orderbook-attach-tp-limit").fill("15");

    await expect(
      page.getByTestId("direct-orderbook-attach-tp-trigger-error"),
    ).toContainText(/greater than 0/);
    await expect(page.getByTestId("direct-orderbook-submit")).toBeDisabled();
    expect(captured.request).toBeNull();
  });

  test("invalid SL limit (non-decimal) disables submit + shows inline error", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured);
    await gotoTicket(page);
    await fillBaseTicket(page);

    await page.getByTestId("direct-orderbook-attach-sl-toggle").check();
    await page.getByTestId("direct-orderbook-attach-sl-trigger").fill("5");
    await page.getByTestId("direct-orderbook-attach-sl-limit").fill("abc");

    await expect(
      page.getByTestId("direct-orderbook-attach-sl-limit-error"),
    ).toContainText(/valid price/);
    await expect(page.getByTestId("direct-orderbook-submit")).toBeDisabled();
    expect(captured.request).toBeNull();
  });

  test("backend rejection (attached_tp_sl_invalid) is surfaced in the error cell", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured, () => ({
      status: 400,
      body: {
        error: "invalid attached TP/SL: link_as_oco=true requires BOTH legs",
      },
    }));
    await gotoTicket(page);
    await fillBaseTicket(page);

    await page.getByTestId("direct-orderbook-attach-tp-toggle").check();
    await page
      .getByTestId("direct-orderbook-attach-tp-trigger")
      .fill("15");
    await page
      .getByTestId("direct-orderbook-attach-tp-limit")
      .fill("15");

    await page.getByTestId("direct-orderbook-submit").click();
    await expect(
      page.getByTestId("direct-orderbook-error-message"),
    ).toContainText(/invalid attached TP\/SL/);
    expect(captured.request?.attached_tp_sl).toBeTruthy();
    // The success-cell attached copy must NOT render on rejection.
    await expect(
      page.getByTestId("direct-orderbook-result-attached"),
    ).toHaveCount(0);
  });
});
