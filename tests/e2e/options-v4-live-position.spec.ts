import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

// This spec is run only by the disposable Anvil/PG/Rust/Next V4 bench.
const BUYER_KEY = `0x${"0".repeat(61)}b0b` as const;
const SELLER_KEY = `0x${"0".repeat(60)}ca11` as const;

async function signIn(page: Page, key: `0x${string}`) {
  page.setDefaultTimeout(30_000);
  const account = privateKeyToAccount(key);
  await installMockWallet(page, { testPrivateKey: key, chainId: BASE_SEPOLIA_CHAIN_ID, realTypedData: true });
  await page.goto("/portfolio", { timeout: 60_000 });
  await page.getByTestId("wallet-connect-button").click();
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
  expect((await page.context().cookies()).some((cookie) => cookie.name === "deopt_wallet_read")).toBe(true);
  await page.reload({ timeout: 60_000 });
  await page.getByTestId("wallet-connect-button").click();
  return account.address;
}

test("real indexed Anvil position reaches authenticated Next.js portfolio for two wallets", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const optionId = process.env.OPTIONS_V4_OPTION_ID;
  const buyer = process.env.OPTIONS_V4_BUYER;
  const seller = process.env.OPTIONS_V4_SELLER;
  const localApi = process.env.OPTIONS_V4_API_URL;
  expect(optionId).toMatch(/^\d+$/);
  expect(buyer).toMatch(/^0x[0-9a-fA-F]{40}$/);
  expect(seller).toMatch(/^0x[0-9a-fA-F]{40}$/);
  expect(localApi).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  const buyerContext: BrowserContext = await browser.newContext({ baseURL });
  const sellerContext: BrowserContext = await browser.newContext({ baseURL });
  try {
    const buyerPage = await buyerContext.newPage();
    expect((await signIn(buyerPage, BUYER_KEY)).toLowerCase()).toBe(buyer?.toLowerCase());
    const sellerPage = await sellerContext.newPage();
    expect((await signIn(sellerPage, SELLER_KEY)).toLowerCase()).toBe(seller?.toLowerCase());
    if (process.env.OPTIONS_V4_PHASE === "settled" || process.env.OPTIONS_V4_PHASE === "reorg") {
      await expect(buyerPage.getByTestId(`position-row-${optionId}`)).toHaveCount(0);
      await expect(sellerPage.getByTestId(`position-row-${optionId}`)).toHaveCount(0);
      await expect(buyerPage.getByText("No open positions")).toBeVisible();
      await expect(sellerPage.getByText("No open positions")).toBeVisible();
      if (process.env.OPTIONS_V5_PRODUCT === "1" && process.env.OPTIONS_V4_PHASE === "settled") {
        await expect(buyerPage.getByTestId(`settlement-proof-${optionId}`)).toBeVisible();
        await expect(sellerPage.getByTestId(`settlement-proof-${optionId}`)).toBeVisible();
      }
      if (process.env.OPTIONS_V5_PRODUCT === "1" && process.env.OPTIONS_V4_PHASE === "reorg") {
        await expect(buyerPage.getByTestId(`settlement-proof-${optionId}`)).toHaveCount(0);
      }
      await sellerPage.reload();
      await sellerPage.getByTestId("wallet-connect-button").click();
      await expect(sellerPage.getByText("No open positions")).toBeVisible();
      return;
    }
    const typedData = await buyerPage.evaluate(async (url) => {
      const response = await fetch(`${url}/local/options-v4/trade`);
      if (!response.ok) throw new Error(`trade metadata HTTP ${response.status}`);
      return response.json();
    }, localApi!);
    const signTrade = async (page: Page, address: string) => page.evaluate(async ({ address, typedData }) => {
      const wallet = (window as unknown as { ethereum: { request(args: { method: string; params: unknown[] }): Promise<string> } }).ethereum;
      return wallet.request({ method: "eth_signTypedData_v4", params: [address, JSON.stringify(typedData)] });
    }, { address, typedData });
    const buyerSignature = await signTrade(buyerPage, buyer!);
    const sellerSignature = await signTrade(sellerPage, seller!);
    const invalidStatus = await buyerPage.evaluate(async ({ url, sellerSignature }) => {
      const response = await fetch(`${url}/local/options-v4/execute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_signature: sellerSignature, seller_signature: sellerSignature }),
      });
      return response.status;
    }, { url: localApi!, sellerSignature });
    expect(invalidStatus).toBe(401);
    const trade = await buyerPage.evaluate(async ({ url, buyerSignature, sellerSignature }) => {
      const body = JSON.stringify({ buyer_signature: buyerSignature, seller_signature: sellerSignature });
      const response = await fetch(`${url}/local/options-v4/execute`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      return { status: response.status, body: await response.json() };
    }, { url: localApi!, buyerSignature, sellerSignature });
    expect(trade.status).toBe(200);
    expect(trade.body.tx_hash).toMatch(/^0x[0-9a-f]{64}$/i);
    const replayStatus = await buyerPage.evaluate(async ({ url, buyerSignature, sellerSignature }) => {
      const response = await fetch(`${url}/local/options-v4/execute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_signature: buyerSignature, seller_signature: sellerSignature }),
      });
      return response.status;
    }, { url: localApi!, buyerSignature, sellerSignature });
    expect(replayStatus).toBe(409);
    await buyerPage.reload();
    await buyerPage.getByTestId("wallet-connect-button").click();
    const row = buyerPage.getByTestId(`position-row-${optionId}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toHaveAttribute("data-side", "long");
    await expect(row).toContainText("1");
    await expect(buyerPage.getByTestId("positions-partial-warning")).toContainText("MarginEngine");
    const crossWalletStatus = await buyerPage.evaluate(async (address) => {
      const response = await fetch(`/api/deopt/options/accounts/${address}/positions`, { cache: "no-store" });
      return response.status;
    }, seller!);
    expect(crossWalletStatus).toBe(403);
    await sellerPage.reload();
    await sellerPage.getByTestId("wallet-connect-button").click();
    const shortRow = sellerPage.getByTestId(`position-row-${optionId}`);
    await expect(shortRow).toBeVisible({ timeout: 30_000 });
    await expect(shortRow).toHaveAttribute("data-side", "short");
    await sellerPage.reload();
    await sellerPage.getByTestId("wallet-connect-button").click();
    await expect(sellerPage.getByTestId(`position-row-${optionId}`)).toBeVisible();
  } finally {
    await buyerContext.close();
    await sellerContext.close();
  }
});
