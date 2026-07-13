// ATTACHED-TP-SL-PLAN-OBSERVABILITY-V1 — Playwright coverage of
// the AttachedPlansPanel mounted at the bottom of the Conditional
// tab in the Trade widget.
//
// `page.route` mocks `GET /accounts/:address/conditional-orders`
// (existing surface, returned empty) AND
// `GET /accounts/:address/option-order-attachment-plans` (the new
// surface this milestone added). The spec asserts the panel
// renders pending / active / failed / cancelled rows with the
// documented status labels, surfaces failure reasons, and that
// an unknown status falls back to the raw token (forward-compat).

import { test, expect, type Route } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
} from "./wallet-helpers";

const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const SERIES_ID =
  "0x62e9de8122013ec803cddbbe018c92dd78871c68a1b37c0b9eb39bca13a5f43f";

interface Plan {
  plan_id: string;
  parent_order_id: string;
  account: string;
  option_series_id: string;
  status: string;
  link_as_oco: boolean;
  take_profit_trigger_price_1e8?: string;
  take_profit_limit_price_1e8?: string;
  stop_loss_trigger_price_1e8?: string;
  stop_loss_limit_price_1e8?: string;
  materialized_size_1e8?: string;
  take_profit_conditional_order_id?: string;
  stop_loss_conditional_order_id?: string;
  oco_group_id?: string;
  failure_code?: string;
  failure_message?: string;
  created_at_ms: number;
  updated_at_ms: number;
}

function plan(p: Partial<Plan> & { plan_id: string; status: string }): Plan {
  return {
    plan_id: p.plan_id,
    parent_order_id: p.parent_order_id ?? "11111111-2222-3333-4444-555555555555",
    account: p.account ?? ACCOUNT,
    option_series_id: p.option_series_id ?? SERIES_ID,
    status: p.status,
    link_as_oco: p.link_as_oco ?? false,
    take_profit_trigger_price_1e8: p.take_profit_trigger_price_1e8,
    take_profit_limit_price_1e8: p.take_profit_limit_price_1e8,
    stop_loss_trigger_price_1e8: p.stop_loss_trigger_price_1e8,
    stop_loss_limit_price_1e8: p.stop_loss_limit_price_1e8,
    materialized_size_1e8: p.materialized_size_1e8,
    take_profit_conditional_order_id: p.take_profit_conditional_order_id,
    stop_loss_conditional_order_id: p.stop_loss_conditional_order_id,
    oco_group_id: p.oco_group_id,
    failure_code: p.failure_code,
    failure_message: p.failure_message,
    created_at_ms: p.created_at_ms ?? 1_782_000_000_000,
    updated_at_ms: p.updated_at_ms ?? 1_782_000_000_000,
  };
}

async function mockConditionalsEmpty(page: import("@playwright/test").Page) {
  await page.route("**/accounts/*/conditional-orders", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}

async function mockAttachmentPlans(
  page: import("@playwright/test").Page,
  plans: Plan[],
) {
  await page.route(
    "**/accounts/*/option-order-attachment-plans*",
    async (route: Route) => {
      const req = route.request();
      expect(req.method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plans }),
      });
    },
  );
}

async function gotoConditionalTab(page: import("@playwright/test").Page) {
  await installConnectedWallet(page);
  await page.goto("/options");
  await connectWallet(page);
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("account-lifecycle-panel")).toBeVisible();
  await page.getByTestId("account-lifecycle-tab-conditional").click();
  await expect(page.getByTestId("attached-plans-panel")).toBeVisible();
}

// Skipped: the AccountLifecyclePanel tab strip (Open orders / Fills /
// TP-SL) was removed from the options trade widget. The AttachedPlansPanel
// still exists and hits the backend, but it is no longer reachable from
// the UI. Re-enable when the panel is remounted on another route.
test.describe.skip("Attached TP/SL plans panel", () => {
  test("empty state renders when the account has no plans", async ({
    page,
  }) => {
    await mockConditionalsEmpty(page);
    await mockAttachmentPlans(page, []);
    await gotoConditionalTab(page);
    await expect(page.getByTestId("attached-plans-empty")).toBeVisible();
    await expect(page.getByTestId("attached-plans-empty")).toContainText(
      /No attached TP\/SL plans/i,
    );
  });

  test("pending plan renders with the waiting-for-fill label", async ({
    page,
  }) => {
    await mockConditionalsEmpty(page);
    await mockAttachmentPlans(page, [
      plan({
        plan_id: "00000000-0000-0000-0000-000000000001",
        status: "pending",
        take_profit_trigger_price_1e8: "1500000000",
        take_profit_limit_price_1e8: "1500000000",
      }),
    ]);
    await gotoConditionalTab(page);
    const row = page.getByTestId(
      "attached-plans-row-00000000-0000-0000-0000-000000000001",
    );
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-plan-status", "pending");
    await expect(
      page.getByTestId(
        "attached-plans-row-00000000-0000-0000-0000-000000000001-status",
      ),
    ).toContainText(/Waiting for entry fill/i);
  });

  test("active plan shows linked conditional ids and active label", async ({
    page,
  }) => {
    await mockConditionalsEmpty(page);
    await mockAttachmentPlans(page, [
      plan({
        plan_id: "00000000-0000-0000-0000-000000000002",
        status: "active",
        link_as_oco: true,
        take_profit_trigger_price_1e8: "1500000000",
        take_profit_limit_price_1e8: "1500000000",
        stop_loss_trigger_price_1e8: "500000000",
        stop_loss_limit_price_1e8: "500000000",
        materialized_size_1e8: "100000000",
        take_profit_conditional_order_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        stop_loss_conditional_order_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        oco_group_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      }),
    ]);
    await gotoConditionalTab(page);
    const row = page.getByTestId(
      "attached-plans-row-00000000-0000-0000-0000-000000000002",
    );
    await expect(row).toHaveAttribute("data-plan-status", "active");
    await expect(
      page.getByTestId(
        "attached-plans-row-00000000-0000-0000-0000-000000000002-status",
      ),
    ).toContainText(/TP\/SL legs created/i);
    await expect(row).toContainText(/aaaaaa/);
    await expect(row).toContainText(/bbbbbb/);
    await expect(row).toContainText(/OCO linked/i);
  });

  test("failed plan shows the failure reason inline", async ({ page }) => {
    await mockConditionalsEmpty(page);
    await mockAttachmentPlans(page, [
      plan({
        plan_id: "00000000-0000-0000-0000-000000000003",
        status: "failed",
        take_profit_trigger_price_1e8: "1500000000",
        take_profit_limit_price_1e8: "1500000000",
        failure_code: "conditional_create_failed",
        failure_message: "no reducible option position",
      }),
    ]);
    await gotoConditionalTab(page);
    const failureCell = page.getByTestId(
      "attached-plans-row-00000000-0000-0000-0000-000000000003-failure",
    );
    await expect(failureCell).toBeVisible();
    await expect(failureCell).toContainText(/conditional_create_failed/);
    await expect(failureCell).toContainText(/no reducible option position/);
  });

  test("cancelled plan renders with the parent-cancelled label", async ({
    page,
  }) => {
    await mockConditionalsEmpty(page);
    await mockAttachmentPlans(page, [
      plan({
        plan_id: "00000000-0000-0000-0000-000000000004",
        status: "cancelled",
        take_profit_trigger_price_1e8: "1500000000",
        take_profit_limit_price_1e8: "1500000000",
      }),
    ]);
    await gotoConditionalTab(page);
    await expect(
      page.getByTestId(
        "attached-plans-row-00000000-0000-0000-0000-000000000004-status",
      ),
    ).toContainText(/Parent cancelled before fill/i);
  });

  test("unknown status falls back to the raw token (forward-compat)", async ({
    page,
  }) => {
    await mockConditionalsEmpty(page);
    await mockAttachmentPlans(page, [
      plan({
        plan_id: "00000000-0000-0000-0000-000000000005",
        status: "future_unknown_status",
        take_profit_trigger_price_1e8: "1500000000",
        take_profit_limit_price_1e8: "1500000000",
      }),
    ]);
    await gotoConditionalTab(page);
    const status = page.getByTestId(
      "attached-plans-row-00000000-0000-0000-0000-000000000005-status",
    );
    await expect(status).toBeVisible();
    await expect(status).toContainText(/future_unknown_status/);
  });

  test("backend error is surfaced (panel doesn't pretend plans loaded)", async ({
    page,
  }) => {
    await mockConditionalsEmpty(page);
    await page.route(
      "**/accounts/*/option-order-attachment-plans*",
      async (route: Route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "transient backend failure" }),
        });
      },
    );
    await gotoConditionalTab(page);
    const err = page.getByTestId("attached-plans-error");
    await expect(err).toBeVisible();
    await expect(err).toContainText(/transient backend failure/);
    // No list rendered.
    await expect(page.getByTestId("attached-plans-list")).toHaveCount(0);
  });
});
