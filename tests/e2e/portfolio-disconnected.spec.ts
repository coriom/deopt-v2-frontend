import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("portfolio renders wallet-disconnected EmptyState before connect", async ({
  page,
}) => {
  // Install mock with account=null so the wallet is detected but not
  // connected. The user has not clicked "Connect wallet" yet.
  await installMockWallet(page, { account: undefined });
  // Clear the account immediately after install so the hooks see null.
  await page.addInitScript(() => {
    type Ctrl = { setAccount: (a: null) => void };
    const w = window as unknown as { __deoptMockWallet?: Ctrl };
    w.__deoptMockWallet?.setAccount(null);
  });
  await page.goto("/portfolio");
  // PortfolioSummary / PositionsTable / BalancesCard all show
  // "Connect your wallet" EmptyState when address is null.
  await expect(page.getByText(/Connect your wallet/i).first()).toBeVisible();
});
