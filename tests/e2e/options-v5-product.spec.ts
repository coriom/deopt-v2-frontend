import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
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
  await page.getByTestId(/^chain-call-/).first().click({ timeout: 20_000 });
  await expect(page.getByTestId("trade-ticket")).toBeVisible();
}

async function openPortfolio(context: BrowserContext, key: `0x${string}`) {
  const page = await context.newPage();
  await installMockWallet(page, { testPrivateKey: key, chainId: BASE_SEPOLIA_CHAIN_ID, realTypedData: true });
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
  test.setTimeout(240_000);
  const optionId = process.env.OPTIONS_V4_OPTION_ID!;
  const buyerContext = await browser.newContext({ baseURL });
  const sellerContext = await browser.newContext({ baseURL });
  try {
    const buyerPage = await buyerContext.newPage();
    const sellerPage = await sellerContext.newPage();
    await signIn(buyerPage, BUYER_KEY);
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
    await buyerPage.getByTestId("sign-button").click();
    await expectIntentSubmitted(buyerPage, intentId);

    await openCallTicket(sellerPage);
    await sellerPage.getByTestId("side-sell").click({ timeout: 20_000 });
    await sellerPage.getByTestId("intent-id-input").fill(intentId);
    await sellerPage.getByTestId("sign-button").click();
    await expectIntentSubmitted(sellerPage, intentId);

    const buyerPortfolio = await openPortfolio(buyerContext, BUYER_KEY);
    await expect(buyerPortfolio.getByTestId(`position-row-${optionId}`)).toHaveAttribute("data-side", "long", { timeout: 45_000 });
    await expect(buyerPortfolio.getByTestId(`premium-proof-${optionId}`)).toContainText("paid 100000000 native");
    await expect(buyerPortfolio.getByTestId(`fee-proof-${optionId}`)).toContainText("25000 native");
    const crossWallet = await buyerPortfolio.evaluate(async (address) =>
      (await fetch(`/api/deopt/options/accounts/${address}/positions`, { cache: "no-store" })).status, seller);
    expect(crossWallet).toBe(403);
    const sellerPortfolio = await openPortfolio(sellerContext, SELLER_KEY);
    await expect(sellerPortfolio.getByTestId(`position-row-${optionId}`)).toHaveAttribute("data-side", "short");
    await expect(sellerPortfolio.getByTestId(`premium-proof-${optionId}`)).toContainText("received 100000000 native");
    await expect(sellerPortfolio.getByTestId(`fee-proof-${optionId}`)).toContainText("5000 native");
  } finally {
    await buyerContext.close();
    await sellerContext.close();
  }
});
