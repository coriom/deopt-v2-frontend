import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the DeOpt V2 trading MVP smoke suite.
 *
 * **Posture:** local-only. NO mainnet. NO Sepolia tx. NO real wallet.
 * The wallet fixture at `tests/e2e/wallet-fixture.ts` injects a mock
 * EIP-1193 provider into the browser context so signing flows can be
 * exercised without a real wallet extension.
 *
 * Run:
 *   npm run e2e:install   # one-time chromium download
 *   npm run e2e:local     # against http://localhost:3000 by default
 *
 * Or against a Prism mock backend:
 *   E2E_BASE_URL=http://localhost:3000 \
 *   E2E_BACKEND_URL=http://localhost:4010 \
 *     npm run e2e:local
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    headless: true,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
