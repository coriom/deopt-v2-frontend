// Read-only browser acceptance. No wallet provider, stored session or bypass.
import { chromium, expect } from "@playwright/test";

const base = new URL(process.argv[2] ?? "https://deoptv2-frontend.vercel.app");
const expectedCommit = process.argv[3] ?? null;
if (expectedCommit && !/^[a-f0-9]{40}$/.test(expectedCommit)) {
  throw new Error("Expected commit must be a full Git SHA.");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ serviceWorkers: "block" });
const firstPartyErrors = [];
const thirdPartyErrors = [];
const failedFirstPartyResources = [];
const warnings = { firstParty: 0, thirdParty: 0 };
const failures = [];
page.on("pageerror", (error) => {
  if (/(?:chrome|moz|safari)-extension:\/\/|tradingview\.com\//i.test(error.stack ?? "")) {
    thirdPartyErrors.push(error.name);
  } else {
    firstPartyErrors.push(error.name);
  }
});
page.on("requestfailed", (request) => {
  try {
    const url = new URL(request.url());
    // Fast route changes abort in-flight requests by design.
    if (url.origin === base.origin && request.failure()?.errorText !== "net::ERR_ABORTED") {
      failedFirstPartyResources.push(url.pathname);
    }
  } catch {
    // Ignore malformed third-party URLs.
  }
});
page.on("console", (message) => {
  if (!["warning", "error"].includes(message.type())) return;
  try {
    const source = new URL(message.location().url);
    if (source.origin === base.origin) warnings.firstParty++;
    else warnings.thirdParty++;
  } catch {
    warnings.thirdParty++;
  }
});

async function visit(route) {
  const response = await page.goto(new URL(route, base).href, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  if (response?.status() !== 200) failures.push(route + ": HTTP " + response?.status());
  if (await page.locator("body").innerText().then((body) => body.includes("Application error"))) {
    failures.push(route + ": application error screen");
  }
  await expect(page.getByTestId("terminal-navbar")).toBeVisible({ timeout: 10_000 });
}

async function releaseCommit() {
  const marker = page.locator('meta[name="deopt-commit"]');
  return (await marker.count()) ? marker.getAttribute("content") : null;
}

try {
  if (expectedCommit) {
    const deadline = Date.now() + 5 * 60_000;
    let observed = null;
    while (Date.now() < deadline) {
      await visit("/");
      observed = await releaseCommit();
      if (observed === expectedCommit) break;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    if (observed !== expectedCommit) {
      failures.push("production commit did not reach expected SHA");
    }
  }
  for (const route of ["/", "/options", "/perps", "/custom"]) {
    await visit(route);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-navbar")).toBeVisible({ timeout: 10_000 });
    if (await page.locator("body").innerText().then((body) => body.includes("Application error"))) {
      failures.push(route + ": reload application error");
    }
  }
  await visit("/");
  const connectButton = page.getByRole("button", { name: /Connect wallet/i });
  const installLink = page.getByRole("link", { name: /Install a wallet/i });
  if (!(await connectButton.isVisible()) && !(await installLink.isVisible())) {
    failures.push("wallet disconnected state missing");
  }
  await visit("/perps");
  await expect(page.getByTitle("BTC-PERP TradingView reference chart")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("widget-perps-trade-submit")).toBeDisabled({ timeout: 10_000 });
  await page.getByTestId("navbar-link-options").click();
  await expect(page).toHaveURL(/\/options$/, { timeout: 10_000 });
  await page.getByTestId("navbar-link-perps").click();
  await expect(page).toHaveURL(/\/perps$/, { timeout: 10_000 });
  await page.waitForTimeout(1500);
  if (firstPartyErrors.length) failures.push("uncaught first-party browser exceptions");
  if (failedFirstPartyResources.length) failures.push("failed first-party resources");
  console.log(JSON.stringify({
    verdict: failures.length ? "FAIL" : "PASS",
    commit: await releaseCommit(),
    routes: ["/", "/options", "/perps", "/custom"],
    firstPartyExceptions: firstPartyErrors.length,
    thirdPartyExceptions: thirdPartyErrors.length,
    failedFirstPartyResources: [...new Set(failedFirstPartyResources)].slice(0, 5),
    warnings,
    failures,
  }));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
