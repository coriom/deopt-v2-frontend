import { expect, test } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import { verifyTypedData } from "viem";
import { installMockWallet } from "./wallet-fixture";

test("two browser wallets produce verifiable EIP-712 signatures", async ({ context }) => {
  for (const key of [
    `0x${"0".repeat(61)}b0b`,
    `0x${"0".repeat(60)}ca11`,
  ] as `0x${string}`[]) {
    const signer = privateKeyToAccount(key);
    const page = await context.newPage();
    await installMockWallet(page, { testPrivateKey: key, realTypedData: true });
    await page.goto("data:text/html,<title>DeOpt local wallet proof</title>");
    const typedData = {
      domain: {
        name: "DeOptV2-OptionMatchingEngine",
        version: "1",
        chainId: 31337,
        verifyingContract: "0x610178da211fef7d417bc0e6fed39f05609ad788" as `0x${string}`,
      },
      types: { Probe: [
        { name: "wallet", type: "address" },
        { name: "nonce", type: "uint256" },
      ] },
      primaryType: "Probe" as const,
      message: { wallet: signer.address, nonce: 1 },
    };
    const signature = await page.evaluate(async ({ wallet, payload }) => {
      const provider = (window as unknown as {
        ethereum: { request: (args: { method: string; params: unknown[] }) => Promise<string> };
      }).ethereum;
      return provider.request({ method: "eth_signTypedData_v4", params: [wallet, JSON.stringify(payload)] });
    }, { wallet: signer.address, payload: typedData });
    expect(await verifyTypedData({
      ...typedData,
      address: signer.address,
      signature: signature as `0x${string}`,
    })).toBe(true);
    await page.close();
  }
});
