import { expect, test, type Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

const buyerKey = `0x${"0".repeat(61)}b0b` as `0x${string}`;
const sellerKey = `0x${"0".repeat(60)}ca11` as `0x${string}`;
const rpcUrl = process.env.OPTIONS_V19_RPC_URL!;
const seriesId = process.env.OPTIONS_V19_SERIES_ID!;
const physicalRegistry = process.env.OPTIONS_V19_PHYSICAL_REGISTRY!;
const legacyRegistry = process.env.OPTIONS_V19_LEGACY_REGISTRY!;
const buyer = privateKeyToAccount(buyerKey).address;
const seller = privateKeyToAccount(sellerKey).address;
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(rpcUrl)) throw new Error("Anvil must be loopback");
  const response = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const reply = await response.json() as { result?: unknown; error?: { message: string } };
  if (reply.error) throw new Error(reply.error.message);
  return reply.result;
}

async function signIn(page: Page, key: `0x${string}`) {
  const account = privateKeyToAccount(key);
  await installMockWallet(page, { testPrivateKey: key, chainId: BASE_SEPOLIA_CHAIN_ID,
    realTypedData: true, localAnvilRpc: rpcUrl });
  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  await connectIfNeeded(page);
  const challenge = await page.evaluate(async (address) => {
    const result = await fetch("/api/deopt/challenge", { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
    if (!result.ok) throw new Error(`challenge ${result.status}`);
    return result.json() as Promise<{ nonce: string; message: string }>;
  }, account.address);
  const signature = await account.signMessage({ message: challenge.message });
  const status = await page.evaluate(async ({ nonce, signature }) => {
    return (await fetch("/api/deopt/verify", { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nonce, signature }) })).status;
  }, { nonce: challenge.nonce, signature });
  expect(status).toBe(200);
}

async function connectIfNeeded(page: Page) {
  const button = page.getByTestId("wallet-connect-button");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await button.getAttribute("data-wallet-state")) !== "no-provider") break;
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await expect(button).toHaveAttribute("data-wallet-state", /^(connected|disconnected|error)$/, { timeout: 10_000 });
  if ((await button.getAttribute("data-wallet-state")) !== "connected") await button.click();
  await expect(button).toHaveAttribute("data-wallet-state", "connected");
}

async function choosePhysical(page: Page) {
  await page.goto("/options", { waitUntil: "domcontentloaded" });
  await connectIfNeeded(page);
  const physical = page.getByTestId(new RegExp(`^chain-call-.*${physicalRegistry.toLowerCase()}`));
  const legacy = page.getByTestId(new RegExp(`^chain-call-.*${legacyRegistry.toLowerCase()}`));
  // The fixtures use distinct underlying token addresses. The chain filters
  // by underlying, so assert the legacy row before selecting the second asset.
  await expect(legacy.first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("underlying-select").selectOption({ index: 1 });
  await expect(physical.first()).toBeVisible({ timeout: 60_000 });
  await physical.first().click();
  await expect(page.getByTestId("trade-ticket")).toBeVisible();
  await expect(page.getByTestId("trade-side-microcopy")).toContainText("Physical exercise");
}

async function openPortfolio(page: Page) {
  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  await connectIfNeeded(page);
  await expect(page.getByTestId("physical-positions")).toBeVisible();
}

async function physicalData(page: Page) {
  return page.evaluate(async (address) => {
    const result = await fetch(`/api/deopt/options/accounts/${address}/physical-positions`, { cache: "no-store" });
    const envelope = await result.json() as { data?: {
      series_id: string; engine: `0x${string}`; underlying: `0x${string}`; quote: `0x${string}`;
      expiry: number; exercise_deadline: number; positions: Array<{
        open_contracts: string; exercised_contracts: string; lapsed_contracts: string;
        premium_native: string; strike_paid_native: string;
        underlying_delivered_native: string; underlying_returned_native: string;
        proof: Array<{ event: string; tx_hash: string }>;
      }>;
    } };
    return { status: result.status, data: envelope.data };
  }, buyer);
}

test("real physical Call: product signatures, exercise, delivery, lapse, reorg", async ({ browser, baseURL }) => {
  test.setTimeout(360_000);
  const buyerContext = await browser.newContext({ baseURL });
  const sellerContext = await browser.newContext({ baseURL });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  try {
    const buyerPage = await buyerContext.newPage();
    const sellerPage = await sellerContext.newPage();
    buyerPage.setDefaultNavigationTimeout(45_000);
    sellerPage.setDefaultNavigationTimeout(45_000);
    await signIn(buyerPage, buyerKey);
    await signIn(sellerPage, sellerKey);
    await choosePhysical(buyerPage);
    await buyerPage.getByTestId("trade-counterparty-input").fill(seller);
    await buyerPage.getByTestId("trade-size-input").fill("2");
    await buyerPage.getByTestId("trade-price-input").fill("10000000000");
    await expect(buyerPage.getByTestId("quote-premium")).toHaveText("200000000");
    if (await buyerPage.getByTestId("create-intent-button").isDisabled()) {
      console.log("V19_FORM_DIAGNOSTIC", JSON.stringify({
        wallet: await buyerPage.getByTestId("wallet-connect-button").getAttribute("data-wallet-state"),
        counterparty: await buyerPage.getByTestId("trade-counterparty-input").inputValue(),
        size: await buyerPage.getByTestId("trade-size-input").inputValue(),
        price: await buyerPage.getByTestId("trade-price-input").inputValue(),
        body: (await buyerPage.getByTestId("trade-ticket").innerText()).slice(0, 600),
      }));
    }
    await buyerPage.getByTestId("create-intent-button").click();
    const intent = buyerPage.getByTestId("intent-id-input");
    await expect(intent).toHaveValue(/^[0-9a-f-]{36}$/i);
    const intentId = await intent.inputValue();
    await buyerPage.getByTestId("sign-button").click();
    await expect.poll(() => buyerPage.url(), { timeout: 30_000 }).toContain(`/transactions/${intentId}`);
    await choosePhysical(sellerPage);
    await sellerPage.getByTestId("side-sell").click();
    await sellerPage.getByTestId("intent-id-input").fill(intentId);
    await sellerPage.getByTestId("sign-button").click();
    await expect.poll(() => sellerPage.url(), { timeout: 30_000 }).toContain(`/transactions/${intentId}`);

    await expect.poll(async () => (await physicalData(buyerPage)).data?.positions[0]?.open_contracts,
      { timeout: 90_000 }).toBe("2");
    await openPortfolio(buyerPage);
    await openPortfolio(sellerPage);
    await expect(buyerPage.getByTestId("physical-positions")).toContainText("2 open / 2 filled");
    const initial = await physicalData(buyerPage);
    expect(initial.status).toBe(200);
    expect(initial.data?.series_id).toBe(seriesId);
    expect(initial.data?.positions[0]?.premium_native).toBe("200000000");
    const engine = initial.data!.engine;
    const weth = initial.data!.underlying;
    const usdc = initial.data!.quote;
    const snapshot = await rpc("evm_snapshot", []) as string;
    const cross = await buyerPage.evaluate(async (address) =>
      (await fetch(`/api/deopt/options/accounts/${address}/physical-positions`, { cache: "no-store" })).status, seller);
    expect(cross).toBe(403);
    const anonymous = await browser.newContext({ baseURL });
    try {
      const response = await anonymous.request.get(`/api/deopt/options/accounts/${buyer}/physical-positions`);
      expect(response.status()).toBe(401);
    } finally { await anonymous.close(); }

    await rpc("evm_setNextBlockTimestamp", [initial.data!.expiry]);
    await rpc("anvil_mine", ["0x1"]);
    await expect(buyerPage.getByTestId("physical-exercise")).toBeVisible({ timeout: 20_000 });
    await buyerPage.getByTestId("physical-exercise").click();
    await expect.poll(async () => (await physicalData(buyerPage)).data?.positions[0]?.exercised_contracts,
      { timeout: 45_000 }).toBe("1");
    const exerciseHash = await buyerPage.getByTestId("physical-tx").innerText() as `0x${string}`;
    const exerciseReceipt = await publicClient.getTransactionReceipt({ hash: exerciseHash });
    expect(exerciseReceipt.status).toBe("success");
    const exercised = await physicalData(buyerPage);
    expect(exercised.data?.positions[0]?.strike_paid_native).toBe("2250000000");
    expect(exercised.data?.positions[0]?.underlying_delivered_native).toBe("1000000000000000000");
    expect(exercised.data?.positions[0]?.proof).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "PhysicalExercise", tx_hash: exerciseHash }),
    ]));
    await expect(buyerPage.getByTestId("physical-flows")).toContainText("delivered 1000000000000000000");
    await expect(buyerPage.getByTestId("physical-balances")).toContainText("1000000000000000000 mWETH native · 2550000000 mUSDC native");
    expect(await publicClient.readContract({ address: weth, abi: erc20, functionName: "balanceOf", args: [buyer] }))
      .toBe(BigInt("1000000000000000000"));
    expect(await publicClient.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [seller] }))
      .toBe(BigInt(2450000000));
    // The second contract remains open; after the deadline its buyer right lapses.
    await rpc("evm_setNextBlockTimestamp", [initial.data!.exercise_deadline]);
    await rpc("anvil_mine", ["0x1"]);
    await expect(sellerPage.getByTestId("physical-release")).toBeVisible({ timeout: 20_000 });
    await sellerPage.getByTestId("physical-release").click();
    await expect.poll(async () => (await physicalData(buyerPage)).data?.positions[0]?.lapsed_contracts,
      { timeout: 45_000 }).toBe("1");
    const releaseHash = await sellerPage.getByTestId("physical-tx").innerText() as `0x${string}`;
    const releaseReceipt = await publicClient.getTransactionReceipt({ hash: releaseHash });
    expect(releaseReceipt.status).toBe("success");
    const final = await physicalData(buyerPage);
    expect(final.data?.positions[0]?.open_contracts).toBe("0");
    expect(final.data?.positions[0]?.underlying_returned_native).toBe("1000000000000000000");
    expect(final.data?.positions[0]?.proof).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "LongExpired", tx_hash: releaseHash }),
    ]));
    await expect(sellerPage.getByTestId("physical-balances")).toContainText("1000000000000000000 mWETH native · 2450000000 mUSDC native", { timeout: 30_000 });
    expect(await publicClient.readContract({ address: weth, abi: erc20, functionName: "balanceOf", args: [seller] }))
      .toBe(BigInt("1000000000000000000"));
    expect(await publicClient.readContract({ address: weth, abi: erc20, functionName: "balanceOf", args: [engine] }))
      .toBe(BigInt(0));
    expect(await publicClient.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [buyer] }))
      .toBe(BigInt(2550000000));
    await buyerPage.reload();
    await connectIfNeeded(buyerPage);
    await expect(buyerPage.getByTestId("physical-flows")).toContainText("returned 1000000000000000000");
    // Reorg the two browser-originated physical actions, then verify that
    // neither remains presented as confirmed by the API or browser.
    expect(await rpc("evm_revert", [snapshot])).toBe(true);
    await rpc("anvil_mine", ["0x40"]);
    await expect.poll(async () => (await physicalData(buyerPage)).data?.positions[0]?.open_contracts,
      { timeout: 60_000 }).toBe("2");
    await expect(buyerPage.getByTestId("physical-flows")).toContainText("delivered 0 mWETH native");
    console.log(`V19_BROWSER_EXERCISE_TX=${exerciseHash} BLOCK=${exerciseReceipt.blockNumber} BLOCK_HASH=${exerciseReceipt.blockHash}`);
    console.log(`V19_BROWSER_RELEASE_TX=${releaseHash} BLOCK=${releaseReceipt.blockNumber} BLOCK_HASH=${releaseReceipt.blockHash}`);
    console.log("V19_BROWSER_PHYSICAL_EXERCISE_RELEASE_REORG=PASS");
  } finally {
    await buyerContext.close();
    await sellerContext.close();
  }
});
