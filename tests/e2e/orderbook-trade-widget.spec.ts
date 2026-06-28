// FRONTEND-OPTIONS-DIRECT-ORDERBOOK-V1 — workspace Trade widget e2e.
//
// Exercises the four canonical TIF / post-only scenarios through the
// real `trade` workspace widget on /options (NOT the standalone
// /api/orderbook-sandbox page). The widget's Orderbook mode renders
// the shared DirectOrderbookForm, so this spec validates the wire-up
// + the matching engine contract surfaces correctly inside the
// workspace layout.
//
// `page.route` mocks `POST /options/orders`; no real backend is
// required. The backend matching engine is independently covered by
// `cargo test --test options_tests` (88 tests).

import { test, expect, type Route } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
  mockWriteAuthChallenge,
} from "./wallet-helpers";

const SERIES_ID =
  "0x62e9de8122013ec803cddbbe018c92dd78871c68a1b37c0b9eb39bca13a5f43f";

interface Captured {
  request: {
    option_series_id: string;
    side: "buy" | "sell";
    price_1e8: string;
    size_1e8: string;
    time_in_force: "gtc" | "ioc" | "fok";
    post_only?: boolean;
  } | null;
}

function buildOrder(overrides: {
  size: string;
  remaining: string;
  status:
    | "open"
    | "partially_filled"
    | "filled"
    | "cancelled"
    | "rejected"
    | "expired";
  tif: "gtc" | "ioc" | "fok";
  post_only?: boolean;
  fills?: Array<{ price: string; size: string; maker: string }>;
}) {
  return {
    order_id: "order-1",
    option_series_id: SERIES_ID,
    account: "0x0000000000000000000000000000000000000001",
    side: "buy",
    price_1e8: "1000000000",
    size_1e8: overrides.size,
    remaining_size_1e8: overrides.remaining,
    time_in_force: overrides.tif,
    post_only: overrides.post_only ?? false,
    client_order_id: null,
    nonce: null,
    deadline_ms: null,
    signature: null,
    status: overrides.status,
    created_at_ms: 1_782_000_000_000,
    updated_at_ms: 1_782_000_000_000,
    fills: (overrides.fills ?? []).map((f, i) => ({
      fill_id: `fill-${i}`,
      option_series_id: SERIES_ID,
      buy_order_id: "order-1",
      sell_order_id: `maker-${i}`,
      buyer: "0x0000000000000000000000000000000000000001",
      seller: "0x0000000000000000000000000000000000000001",
      maker_order_id: f.maker,
      taker_order_id: "order-1",
      taker_side: "buy",
      price_1e8: f.price,
      size_1e8: f.size,
      created_at_ms: 1_782_000_000_000,
    })),
  };
}

async function setupOrdersRoute(
  page: import("@playwright/test").Page,
  captured: Captured,
  responder: (req: NonNullable<Captured["request"]>) => {
    status: number;
    body: object;
  },
) {
  await page.route("**/options/orders", async (route: Route) => {
    const req = route.request();
    expect(req.method()).toBe("POST");
    const body = JSON.parse(req.postData() ?? "{}") as NonNullable<
      Captured["request"]
    >;
    captured.request = body;
    const { status, body: respBody } = responder(body);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(respBody),
    });
  });
}

async function gotoTradeOrderbook(page: import("@playwright/test").Page) {
  await installConnectedWallet(page);
  await mockWriteAuthChallenge(page);
  await page.goto("/options");
  await connectWallet(page);
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-form")).toBeVisible();
}

async function fillOrderbookForm(
  page: import("@playwright/test").Page,
  opts: { tif: "GTC" | "IOC" | "FOK"; postOnly?: boolean; size?: string },
) {
  await page.getByTestId("direct-orderbook-series-id").fill(SERIES_ID);
  // Production form requires the account input to match the connected
  // wallet address (write-auth submitter check).
  await page
    .getByTestId("direct-orderbook-account")
    .fill("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  if (opts.size) {
    await page.getByTestId("direct-orderbook-size").fill(opts.size);
  }
  if (opts.tif !== "GTC") {
    await page.getByTestId("direct-orderbook-tif-trigger").click();
    await page.getByTestId(`direct-orderbook-tif-option-${opts.tif}`).click();
  }
  if (opts.postOnly) {
    await page.getByTestId("direct-orderbook-post-checkbox").check();
  }
}

test.describe("Trade workspace widget — direct orderbook end-to-end", () => {
  test("GTC with no opposing liquidity rests as open", async ({ page }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured, (req) => ({
      status: 200,
      body: buildOrder({
        size: req.size_1e8,
        remaining: req.size_1e8,
        status: "open",
        tif: req.time_in_force,
      }),
    }));
    await gotoTradeOrderbook(page);
    await fillOrderbookForm(page, { tif: "GTC", size: "100000000" });
    await page.getByTestId("direct-orderbook-submit").click();

    await expect(page.getByTestId("direct-orderbook-result-status")).toHaveText(
      "open",
    );
    await expect(
      page.getByTestId("direct-orderbook-result-remaining"),
    ).toHaveText("100000000");
    await expect(
      page.getByTestId("direct-orderbook-result-fill-count"),
    ).toHaveText("0");
    expect(captured.request?.time_in_force).toBe("gtc");
    expect(captured.request?.post_only).toBe(false);
  });

  test("IOC remainder is cancelled and surfaces the partial fill", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured, (req) => ({
      status: 200,
      body: buildOrder({
        size: req.size_1e8,
        remaining: "70000000",
        status: "cancelled",
        tif: req.time_in_force,
        fills: [{ price: "1000000000", size: "30000000", maker: "maker-a" }],
      }),
    }));
    await gotoTradeOrderbook(page);
    await fillOrderbookForm(page, { tif: "IOC", size: "100000000" });
    await page.getByTestId("direct-orderbook-submit").click();

    await expect(page.getByTestId("direct-orderbook-result-status")).toHaveText(
      "cancelled",
    );
    await expect(
      page.getByTestId("direct-orderbook-result-remaining"),
    ).toHaveText("70000000");
    await expect(
      page.getByTestId("direct-orderbook-result-fill-count"),
    ).toHaveText("1");
    expect(captured.request?.time_in_force).toBe("ioc");
  });

  test("FOK that cannot be fully filled surfaces the backend rejection", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured, () => ({
      status: 400,
      body: { error: "fill-or-kill order is not fully fillable" },
    }));
    await gotoTradeOrderbook(page);
    await fillOrderbookForm(page, { tif: "FOK", size: "100000000" });
    await page.getByTestId("direct-orderbook-submit").click();

    await expect(
      page.getByTestId("direct-orderbook-error-message"),
    ).toHaveText("fill-or-kill order is not fully fillable");
    await expect(page.getByTestId("direct-orderbook-result")).toHaveCount(0);
    expect(captured.request?.time_in_force).toBe("fok");
    expect(captured.request?.post_only).toBe(false);
  });

  test("post-only that would cross is rejected without showing a fill", async ({
    page,
  }) => {
    const captured: Captured = { request: null };
    await setupOrdersRoute(page, captured, () => ({
      status: 400,
      body: { error: "post-only order would immediately match" },
    }));
    await gotoTradeOrderbook(page);
    await fillOrderbookForm(page, {
      tif: "GTC",
      postOnly: true,
      size: "100000000",
    });
    await page.getByTestId("direct-orderbook-submit").click();

    await expect(
      page.getByTestId("direct-orderbook-error-message"),
    ).toHaveText("post-only order would immediately match");
    await expect(page.getByTestId("direct-orderbook-result")).toHaveCount(0);
    expect(captured.request?.post_only).toBe(true);
    expect(captured.request?.time_in_force).toBe("gtc");
  });

  test("RFQ mode swap removes TIF / post-only controls (honesty check)", async ({
    page,
  }) => {
    let intercepted = false;
    await page.route("**/options/orders", async (route) => {
      intercepted = true;
      await route.fulfill({ status: 500, body: "{}" });
    });
    await gotoTradeOrderbook(page);
    await page.getByTestId("trade-mode-select").selectOption("rfq");
    await expect(page.getByTestId("trade-body-rfq")).toBeVisible();
    await expect(page.getByTestId("direct-orderbook-tif-trigger")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("direct-orderbook-post-checkbox"),
    ).toHaveCount(0);
    // RFQ mode must never reach the orderbook endpoint.
    expect(intercepted).toBe(false);
  });
});
