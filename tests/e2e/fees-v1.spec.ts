/**
 * fees-v1.spec.ts — FRONTEND-FEES-PAGE-V1
 *
 * Covers the new `/fees` page (My Account + Option Fee Tiers + Perp
 * Fee Tiers). The tier values must mirror
 * `~/DEOPT/deopt-v2-backend/src/fees/schedule.rs::launch_fee_schedule()`.
 */
import { test, expect } from "@playwright/test";
import { expectNoPositiveClaimsOrLeaks } from "./copy-claims";

test("/fees renders the new shell with My Account + both tier tables", async ({
  page,
}) => {
  await page.goto("/fees");
  for (const id of [
    "fees-page",
    "fees-page-header",
    "fees-my-account",
    "fees-option-tiers",
    "fees-option-table",
    "fees-perp-tiers",
    "fees-perp-table",
    "fees-page-rebate-note",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("/fees My Account shows $0.00 defaults and the disconnected note", async ({
  page,
}) => {
  await page.goto("/fees");
  await expect(page.getByTestId("fees-my-account-volume")).toContainText(
    /\$0\.00/,
  );
  await expect(page.getByTestId("fees-my-account-rfq")).toContainText(/\$0\.00/);
  await expect(page.getByTestId("fees-my-account-staked")).toContainText(
    /0\.00 stDEOPT/,
  );
  await expect(
    page.getByTestId("fees-my-account-disconnected-note"),
  ).toBeVisible();
});

const OPTION_ROWS = [
  ["≥ $25M", "≥ 5%", "≥ 250,000", "-0.005%", "0.0075%", "100%", "75%"],
  ["≥ $10M", "≥ 2.5%", "≥ 100,000", "-0.0025%", "0.010%", "75%", "50%"],
  ["≥ $2.5M", "≥ 1%", "≥ 50,000", "-0.001%", "0.0125%", "50%", "25%"],
  ["≥ $500k", "≥ 0.25%", "≥ 10,000", "0.000%", "0.015%", "25%", "10%"],
  ["< $500k", "< 0.25%", "< 10,000", "0.005%", "0.025%", "0%", "0%"],
];

test("/fees Option table rows match launch_fee_schedule.option byte-for-byte", async ({
  page,
}) => {
  await page.goto("/fees");
  for (let i = 0; i < OPTION_ROWS.length; i++) {
    const row = page.getByTestId(`fees-option-row-${i}`);
    for (const cell of OPTION_ROWS[i]) {
      await expect(row).toContainText(cell);
    }
  }
});

const PERP_ROWS = [
  ["≥ $25M", "≥ 5%", "≥ 250,000", "-0.010%", "0.015%"],
  ["≥ $10M", "≥ 2.5%", "≥ 100,000", "-0.0075%", "0.0175%"],
  ["≥ $2.5M", "≥ 1%", "≥ 50,000", "-0.005%", "0.020%"],
  ["≥ $500k", "≥ 0.25%", "≥ 10,000", "0.000%", "0.025%"],
  ["< $500k", "< 0.25%", "< 10,000", "0.005%", "0.030%"],
];

test("/fees Perp table rows match launch_fee_schedule.perp byte-for-byte", async ({
  page,
}) => {
  await page.goto("/fees");
  for (let i = 0; i < PERP_ROWS.length; i++) {
    const row = page.getByTestId(`fees-perp-row-${i}`);
    for (const cell of PERP_ROWS[i]) {
      await expect(row).toContainText(cell);
    }
  }
});

test("/fees rebate note explains the asterisk", async ({ page }) => {
  await page.goto("/fees");
  await expect(page.getByTestId("fees-page-rebate-note")).toContainText(
    /operator-whitelisted market makers/i,
  );
});

test("/fees does not colour rebate maker cells emerald", async ({ page }) => {
  await page.goto("/fees");
  // The first column of the top rebate rows must use the default
  // zinc-100 numeric colour — only the asterisk distinguishes them.
  for (const id of [
    "fees-option-row-0",
    "fees-option-row-1",
    "fees-option-row-2",
    "fees-perp-row-0",
    "fees-perp-row-1",
    "fees-perp-row-2",
  ]) {
    const row = page.getByTestId(id);
    await expect(row).not.toContainText(/text-emerald-300/);
  }
});

test("/fees does not highlight any tier row when the wallet is disconnected", async ({
  page,
}) => {
  await page.goto("/fees");
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId(`fees-option-row-${i}`)).toHaveAttribute(
      "data-highlight",
      "false",
    );
    await expect(page.getByTestId(`fees-perp-row-${i}`)).toHaveAttribute(
      "data-highlight",
      "false",
    );
  }
  await expect(page.getByTestId("fees-option-row-4-marker")).toHaveCount(0);
});

test("/fees does not render the bottom public-beta marketing footer", async ({
  page,
}) => {
  await page.goto("/fees");
  await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
});

test("/fees does not introduce amber / yellow / orange brand classes", async ({
  page,
}) => {
  await page.goto("/fees");
  const html = await page.content();
  expect(html).not.toMatch(/\bamber-[0-9]/);
  expect(html).not.toMatch(/\byellow-[0-9]/);
  expect(html).not.toMatch(/\borange-[0-9]/);
});

test("/fees never claims mainnet-ready / audited / production-ready / safe-for-real-funds", async ({
  page,
}) => {
  await page.goto("/fees");
  await expectNoPositiveClaimsOrLeaks(page);
});

test("/fees never exposes admin / bearer / RPC / DB URLs", async ({ page }) => {
  await page.goto("/fees");
  const html = await page.content();
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("/fees never mentions Deribit or Derive in the public UI", async ({
  page,
}) => {
  await page.goto("/fees");
  const text = (await page.textContent("body")) ?? "";
  expect(text).not.toMatch(/deribit/i);
  expect(text).not.toMatch(/derive/i);
});
