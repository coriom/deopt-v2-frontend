// MATCHING-TIF-SEMANTICS-OPTIONS-V1 — frontend wiring tests.
//
// Verifies that the `/api/orderbook-sandbox` page submits a real
// `POST /options/orders` request with `time_in_force` and `post_only`
// in the payload, and that the UI surfaces the deterministic backend
// outcomes for the four canonical scenarios:
//
//   1. GTC resting       — status `open`, no fills
//   2. IOC remainder     — status `cancelled`, fills present,
//                          remaining > 0
//   3. FOK not fillable  — backend 400 with stable message
//   4. Post-only marketable — backend 400 with stable message
//
// `page.route` mocks the backend so the spec runs with no DB and no
// running cargo backend. The backend matching engine itself is
// covered by `cargo test --test options_tests` (88 tests).

import { test, expect, type Route, type Page } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
  mockWriteAuthChallenge,
} from "./wallet-helpers";

const SERIES_ID =
  "0x62e9de8122013ec803cddbbe018c92dd78871c68a1b37c0b9eb39bca13a5f43f";
// The DirectOrderbookForm asserts `walletAddress === account field`,
// so the test wallet's address (anvil[0]) must match what gets typed
// into the account input.
const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function gotoSandbox(page: Page) {
  await installConnectedWallet(page);
  // The form runs the WRITE-AUTH challenge flow before submitting the
  // order (ACCOUNT-WRITE-AUTH-HARDENING-V1); mock the challenge so the
  // submission reaches `POST /options/orders`.
  await mockWriteAuthChallenge(page);
  await page.goto("/api/orderbook-sandbox");
  await connectWallet(page);
}

interface CapturedRequest {
  option_series_id: string;
  account: string;
  side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  time_in_force: "gtc" | "ioc" | "fok";
  post_only?: boolean;
}

function buildOrderResponse(overrides: {
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
    account: ACCOUNT,
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
      buyer: ACCOUNT,
      seller: ACCOUNT,
      maker_order_id: f.maker,
      taker_order_id: "order-1",
      taker_side: "buy",
      price_1e8: f.price,
      size_1e8: f.size,
      created_at_ms: 1_782_000_000_000,
    })),
  };
}

async function setupRoute(
  page: import("@playwright/test").Page,
  captured: { value: CapturedRequest | null },
  responder: (req: CapturedRequest) => {
    status: number;
    body: object;
  },
) {
  await page.route("**/options/orders", async (route: Route) => {
    const req = route.request();
    expect(req.method()).toBe("POST");
    const body = JSON.parse(req.postData() ?? "{}") as CapturedRequest;
    captured.value = body;
    const { status, body: respBody } = responder(body);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(respBody),
    });
  });
}

async function fillForm(
  page: import("@playwright/test").Page,
  opts: {
    tif: "GTC" | "IOC" | "FOK";
    postOnly?: boolean;
    size?: string;
  } = { tif: "GTC" },
) {
  // OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — series id is hidden
  // behind the Advanced tester affordance; open it first.
  await page.getByTestId("direct-orderbook-advanced-summary").click();
  await page.getByTestId("direct-orderbook-series-id").fill(SERIES_ID);
  // Account is auto-populated from the connected wallet — the manual
  // Account field was removed. Limit Price defaults to empty placeholder
  // `0.0` — fill it so `canSubmit` is satisfied.
  await page.getByTestId("direct-orderbook-price").fill("1000000000");
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

test.describe("orderbook sandbox — direct-order TIF + post-only wiring", () => {
  test("GTC with no opposing liquidity rests as open", async ({ page }) => {
    const captured = { value: null as CapturedRequest | null };
    await setupRoute(page, captured, (req) => ({
      status: 200,
      body: buildOrderResponse({
        size: req.size_1e8,
        remaining: req.size_1e8,
        status: "open",
        tif: req.time_in_force,
        post_only: req.post_only,
      }),
    }));
    await gotoSandbox(page);
    await fillForm(page, { tif: "GTC", size: "100000000" });
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
    expect(captured.value?.time_in_force).toBe("gtc");
    expect(captured.value?.post_only).toBe(false);
  });

  test("IOC remainder is cancelled and surfaces the partial fill", async ({
    page,
  }) => {
    const captured = { value: null as CapturedRequest | null };
    await setupRoute(page, captured, (req) => ({
      status: 200,
      body: buildOrderResponse({
        size: req.size_1e8,
        remaining: "70000000",
        status: "cancelled",
        tif: req.time_in_force,
        fills: [{ price: "1000000000", size: "30000000", maker: "maker-a" }],
      }),
    }));
    await gotoSandbox(page);
    await fillForm(page, { tif: "IOC", size: "100000000" });
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
    expect(captured.value?.time_in_force).toBe("ioc");
  });

  test("FOK that cannot be fully filled surfaces the backend rejection", async ({
    page,
  }) => {
    const captured = { value: null as CapturedRequest | null };
    await setupRoute(page, captured, () => ({
      status: 400,
      body: { error: "fill-or-kill order is not fully fillable" },
    }));
    await gotoSandbox(page);
    await fillForm(page, { tif: "FOK", size: "100000000" });
    await page.getByTestId("direct-orderbook-submit").click();

    const error = page.getByTestId("direct-orderbook-error-message");
    await expect(error).toHaveText("fill-or-kill order is not fully fillable");
    await expect(page.getByTestId("direct-orderbook-result")).toHaveCount(0);
    expect(captured.value?.time_in_force).toBe("fok");
    expect(captured.value?.post_only).toBe(false);
  });

  test("post-only that would cross is rejected without entering the book", async ({
    page,
  }) => {
    const captured = { value: null as CapturedRequest | null };
    await setupRoute(page, captured, () => ({
      status: 400,
      body: { error: "post-only order would immediately match" },
    }));
    await gotoSandbox(page);
    await fillForm(page, { tif: "GTC", postOnly: true, size: "100000000" });
    await page.getByTestId("direct-orderbook-submit").click();

    const error = page.getByTestId("direct-orderbook-error-message");
    await expect(error).toHaveText("post-only order would immediately match");
    await expect(page.getByTestId("direct-orderbook-result")).toHaveCount(0);
    expect(captured.value?.post_only).toBe(true);
    expect(captured.value?.time_in_force).toBe("gtc");
  });

  test("sandbox page links from /api developers console", async ({ page }) => {
    await page.goto("/api");
    await expect(
      page.getByTestId("developers-console-orderbook-sandbox-link"),
    ).toBeVisible();
  });
});
