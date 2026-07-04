/**
 * testnet-self-serve-onboarding-v1.spec.ts — TESTNET-SELF-SERVE-ONBOARDING-V1
 *
 * Pins the new self-serve onboarding surfaces:
 *
 *   * /api MintTokensCard upgraded from "Mint UI planned" placeholder
 *     to an honest "Request Test Collateral" card. The 3 deployed
 *     Base Sepolia mock token addresses are visible + copy-able.
 *     No fake mint button; clear pointer to Discord / feedback /
 *     5-minute tester quickstart.
 *   * /perps surfaces a visible "Perps · not live" banner so testers
 *     landing on the route understand the surface is a preview. The
 *     existing workspace shell + widgets render unchanged underneath.
 *   * /docs/quickstart loads the existing BASE_SEPOLIA_QUICKSTART.md
 *     (slug already registered in src/lib/docs-loader.ts).
 *
 * Per discovery: the testnet tokens are deployed but their mint
 * function is `external onlyOwner`. A true self-serve faucet contract
 * is carved out as TESTNET-PUBLIC-FAUCET-CONTRACT-V1 — until that
 * ships the operator mints on request. This spec asserts the
 * intermediate state is honest, not the final state.
 */
import { test, expect } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
} from "./wallet-helpers";

const M_USDC = "0x6eae407f5640b006fac9965182e238582a3b412e";
const M_WETH = "0x4deebc5f537f3b8ba0e3393807b4d699d72bdd02";
const M_WBTC = "0x9d871ac7595e8da271e866608e5145252047967c";

test.describe("/api MintTokensCard upgrade", () => {
  test("renders Request Test Collateral card with all 3 deployed token addresses", async ({
    page,
  }) => {
    await page.goto("/api");
    const card = page.getByTestId("developers-console-mint");
    await expect(card).toBeVisible();

    // Header copy switched from "Mint Tokens" / "Mint UI planned"
    // to the honest "Request Test Collateral" framing.
    await expect(card).toContainText(/Request Test Collateral/);

    // The old disabled placeholder button is GONE — no dead button.
    await expect(page.getByTestId("mint-tokens-action")).toHaveCount(0);

    // All 3 deployed Base Sepolia token tiles surface their address.
    for (const [symbol, address] of [
      ["mUSDC", M_USDC],
      ["mWETH", M_WETH],
      ["mWBTC", M_WBTC],
    ] as const) {
      const tile = page.getByTestId(`mint-tokens-token-${symbol}`);
      await expect(tile).toBeVisible();
      await expect(tile).toHaveAttribute("data-token-symbol", symbol);
      await expect(tile).toHaveAttribute("data-token-address", address);
    }

    // The card is honest about the gating: mint is owner-only today.
    await expect(card).toContainText(/owner-only/i);
    await expect(card).toContainText(/TESTNET-PUBLIC-FAUCET-CONTRACT-V1/);
  });

  test("offers a request path (Discord, feedback, in-app quickstart)", async ({
    page,
  }) => {
    await page.goto("/api");
    const card = page.getByTestId("developers-console-mint");

    const discord = card.getByTestId("mint-tokens-discord-link");
    await expect(discord).toBeVisible();
    await expect(discord).toHaveAttribute("href", /discord\.gg/);

    const feedback = card.getByTestId("mint-tokens-feedback-link");
    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveAttribute("href", "/feedback");

    const quickstart = card.getByTestId("mint-tokens-quickstart-link");
    await expect(quickstart).toBeVisible();
    await expect(quickstart).toHaveAttribute("href", "/docs/quickstart");
  });

  test("shows a connect-wallet prompt when no wallet is connected", async ({
    page,
  }) => {
    // No installMockWallet here — fresh page, no provider injected.
    await page.goto("/api");
    await expect(page.getByTestId("mint-tokens-no-wallet")).toBeVisible();
    await expect(page.getByTestId("mint-tokens-connected-address")).toHaveCount(0);
  });

  test("shows the connected wallet address inline once a wallet is connected", async ({
    page,
  }) => {
    await installConnectedWallet(page);
    await page.goto("/api");
    await connectWallet(page);
    const addr = page.getByTestId("mint-tokens-connected-address");
    await expect(addr).toBeVisible({ timeout: 5_000 });
    // Address is the deterministic anvil[0] that the mock wallet uses.
    await expect(addr).toContainText(/^0x[a-fA-F0-9]{40}$/);
    await expect(page.getByTestId("mint-tokens-address-copy")).toBeVisible();
  });
});

test.describe("/perps posture (page-level banner retired for polish)", () => {
  test("perps workspace shell + widgets render without the retired not-live banner", async ({
    page,
  }) => {
    // The former `perps-not-live-banner` was removed for visual polish.
    // The V1 disclosures banner + hard-disabled trade form + backend
    // fail-closed still communicate the not-live posture. Assert both
    // the shell renders AND the retired banner is gone.
    await page.goto("/perps");
    await expect(page.getByTestId("perps-terminal-shell")).toBeVisible();
    await expect(page.getByTestId("workspace-perps")).toBeVisible();
    await expect(page.getByTestId("widget-perps-trade-form")).toBeVisible();
    await expect(page.getByTestId("perps-not-live-banner")).toHaveCount(0);
  });

  test("/perps page uses zinc/emerald palette (no amber/yellow/orange)", async ({
    page,
  }) => {
    // Palette invariant kept even without the retired banner.
    await page.goto("/perps");
    const html = await page.locator("main").innerHTML();
    expect(html).not.toMatch(/class="[^"]*\bamber-/);
    expect(html).not.toMatch(/class="[^"]*\byellow-/);
    expect(html).not.toMatch(/class="[^"]*\borange-/);
  });
});

test.describe("/docs/quickstart in-app route", () => {
  test("loads the registered BASE_SEPOLIA_QUICKSTART.md doc", async ({
    page,
  }) => {
    const response = await page.goto("/docs/quickstart");
    expect(response?.status()).toBe(200);
    // The doc starts with `# DeOpt V2 — Base Sepolia Quickstart`;
    // assert that title text is visible.
    await expect(page.locator("h1, h2").first()).toContainText(
      /Base Sepolia Quickstart/i,
    );
    // mUSDC address from the discovery + the upgraded card.
    await expect(page.locator("body")).toContainText(
      new RegExp(M_USDC, "i"),
    );
  });
});
