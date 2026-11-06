import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import { encodeAbiParameters, keccak256 } from "viem";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

const BUYER_KEY = `0x${"0".repeat(61)}b0b` as `0x${string}`;
const SELLER_KEY = `0x${"0".repeat(60)}ca11` as `0x${string}`;

async function signIn(page: Page, key: `0x${string}`) {
  const account = privateKeyToAccount(key);
  await installMockWallet(page, { testPrivateKey: key, chainId: BASE_SEPOLIA_CHAIN_ID, realTypedData: true });
  await page.goto("/portfolio", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByTestId("wallet-connect-button").click({ timeout: 20_000 });
  const challenge = await page.evaluate(async (address) => {
    const response = await fetch("/api/deopt/challenge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }), cache: "no-store",
    });
    if (!response.ok) throw new Error(`challenge HTTP ${response.status}`);
    return response.json() as Promise<{ nonce: string; message: string }>;
  }, account.address);
  const signature = await account.signMessage({ message: challenge.message });
  const status = await page.evaluate(async ({ nonce, signature }) => {
    const response = await fetch("/api/deopt/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonce, signature }), cache: "no-store",
    });
    return response.status;
  }, { nonce: challenge.nonce, signature });
  expect(status).toBe(200);
  return account.address;
}

async function openCallTicket(page: Page) {
  await page.goto("/options", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByTestId("wallet-connect-button")).toHaveAttribute("data-wallet-state", "disconnected", { timeout: 20_000 });
  await page.getByTestId("wallet-connect-button").click({ timeout: 20_000 });
  const dedicated = process.env.OPTIONS_V16_DEDICATED_REGISTRY;
  const legacy = process.env.OPTIONS_V16_LEGACY_REGISTRY;
  if (dedicated && legacy) {
    const dedicatedRow = page.getByTestId(new RegExp(`^chain-call-.*${dedicated.toLowerCase()}`));
    const legacyRow = page.getByTestId(new RegExp(`^chain-call-.*${legacy.toLowerCase()}`));
    await expect(dedicatedRow.first()).toBeVisible({ timeout: 60_000 });
    await expect(legacyRow.first()).toBeVisible({ timeout: 60_000 });
    await dedicatedRow.first().click({ timeout: 60_000 });
  } else {
    await page.getByTestId(/^chain-call-/).first().click({ timeout: 60_000 });
  }
  await expect(page.getByTestId("trade-ticket")).toBeVisible();
}

async function openPortfolio(page: Page) {
  await page.goto("/portfolio", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const button = page.getByTestId("wallet-connect-button");
  await expect(button).toHaveAttribute("data-wallet-state", "disconnected", { timeout: 20_000 });
  await button.click({ timeout: 20_000 });
  await expect(button).toHaveAttribute("data-wallet-state", "connected", { timeout: 20_000 });
  return page;
}

async function expectIntentSubmitted(page: Page, intentId: string) {
  await expect.poll(async () => {
    if (page.url().endsWith(`/transactions/${intentId}`)) return "submitted";
    return page.getByTestId("signing-state-modal").getAttribute("data-phase").catch(() => null);
  }, { timeout: 30_000 }).toBe("submitted");
}

test("product form creates and signs a real Rust intent; Anvil receipt reaches the portfolio", async ({ browser, baseURL }) => {
  test.setTimeout(360_000);
  const optionId = process.env.OPTIONS_V4_OPTION_ID!;
  const registry = process.env.OPTIONS_V16_DEDICATED_REGISTRY;
  const legacyRegistry = process.env.OPTIONS_V16_LEGACY_REGISTRY;
  const seriesId = registry && legacyRegistry
    ? keccak256(encodeAbiParameters(
        [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
        [BigInt(84532), registry as `0x${string}`, BigInt(optionId)],
      ))
    : optionId;
  const legacySeriesId = registry && legacyRegistry
    ? keccak256(encodeAbiParameters(
        [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
        [BigInt(84532), legacyRegistry as `0x${string}`, BigInt(optionId)],
      ))
    : null;
  const buyerContext = await browser.newContext({ baseURL });
  const sellerContext = await browser.newContext({ baseURL });
  try {
    const buyerPage = await buyerContext.newPage();
    const sellerPage = await sellerContext.newPage();
    const buyer = await signIn(buyerPage, BUYER_KEY);
    const seller = await signIn(sellerPage, SELLER_KEY);
    await openCallTicket(buyerPage);
    await buyerPage.getByTestId("trade-counterparty-input").fill(seller);
    await buyerPage.getByTestId("trade-size-input").fill("1");
    await buyerPage.getByTestId("trade-price-input").fill("10000000000");
    await expect(buyerPage.getByTestId("quote-premium")).toHaveText("100000000");
    await buyerPage.getByTestId("create-intent-button").click();
    const intentField = buyerPage.getByTestId("intent-id-input");
    await expect(intentField).toHaveValue(/^[0-9a-f-]{36}$/i);
    const intentId = await intentField.inputValue();
    const signatureEndpoint = `${process.env.OPTIONS_V4_API_URL}/options/execution-intents/${intentId}/signatures`;
    await buyerPage.route(signatureEndpoint, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.continue({ postData: JSON.stringify({ ...body, buyer_signature: `0x${"00".repeat(65)}` }) });
    });
    await buyerPage.getByTestId("sign-button").click();
    await expect(buyerPage.getByTestId("signing-state-modal")).toHaveAttribute("data-phase", "backend_unavailable", { timeout: 20_000 });
    await buyerPage.unroute(signatureEndpoint);
    await buyerPage.getByTestId("signing-state-modal").getByRole("button", { name: "Close" }).click();
    await expect(buyerPage.getByTestId("signing-state-modal")).toBeHidden({ timeout: 20_000 });
    await buyerPage.getByTestId("sign-button").click({ timeout: 20_000 });
    await expectIntentSubmitted(buyerPage, intentId);

    await openCallTicket(sellerPage);
    await sellerPage.getByTestId("side-sell").click({ timeout: 60_000 });
    await sellerPage.getByTestId("intent-id-input").fill(intentId);
    await sellerPage.getByTestId("sign-button").click({ timeout: 20_000 });
    await expectIntentSubmitted(sellerPage, intentId);

    // The real Rust indexer runs asynchronously after the Anvil receipt.
    // Wait for its authenticated, reconciled read before checking the UI.
    await expect.poll(async () => buyerPage.evaluate(async (address) =>
      (await fetch(`/api/deopt/options/accounts/${address}/positions`, { cache: "no-store" })).status,
    buyer), { timeout: 90_000, intervals: [1_000, 2_000, 3_000] }).toBe(200);

    const buyerPortfolio = await openPortfolio(buyerPage);
    await expect(buyerPortfolio.getByTestId(`position-row-${seriesId}`)).toHaveAttribute("data-side", "long", { timeout: 45_000 });
    await expect(buyerPortfolio.getByTestId(`premium-proof-${seriesId}`)).toContainText("paid 100000000 native");
    await expect(buyerPortfolio.getByTestId(`fee-proof-${seriesId}`)).toContainText("25000 native");
    if (legacySeriesId) {
      await expect(buyerPortfolio.getByTestId(`position-row-${legacySeriesId}`)).toHaveAttribute("data-side", "long");
    }
    const crossWallet = await buyerPortfolio.evaluate(async (address) =>
      (await fetch(`/api/deopt/options/accounts/${address}/positions`, { cache: "no-store" })).status, seller);
    expect(crossWallet).toBe(403);
    const sellerPortfolio = await openPortfolio(sellerPage);
    await expect(sellerPortfolio.getByTestId(`position-row-${seriesId}`)).toHaveAttribute("data-side", "short");
    await expect(sellerPortfolio.getByTestId(`premium-proof-${seriesId}`)).toContainText("received 100000000 native");
    await expect(sellerPortfolio.getByTestId(`fee-proof-${seriesId}`)).toContainText("5000 native");
    if (legacySeriesId) {
      await expect(sellerPortfolio.getByTestId(`position-row-${legacySeriesId}`)).toHaveAttribute("data-side", "short");
    }
  } finally {
    await buyerContext.close();
    await sellerContext.close();
  }
});
