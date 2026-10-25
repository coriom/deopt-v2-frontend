import { expect, test } from "@playwright/test";

test("reports only fixed diagnostics, deduplicates, and ignores extensions", async ({ page }) => {
  const reports: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/client-errors")) reports.push(request.postData() ?? "");
  });
  await page.goto("/options?wallet=0xSECRET&token=DO_NOT_SEND");
  const reportRequest = page.waitForRequest((request) => request.url().endsWith("/api/client-errors"));
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", {
      message: "wallet=0xSECRET token=DO_NOT_SEND",
      error: new TypeError("wallet=0xSECRET token=DO_NOT_SEND"),
      filename: location.origin + "/_next/static/chunks/app.js",
    }));
  });
  const request = await reportRequest;
  expect((await request.response())?.status()).toBe(204);
  const headers = await request.allHeaders();
  expect(headers.cookie).toBeUndefined();
  expect(headers.referer).toBeUndefined();
  const report = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
  expect(Object.keys(report).sort()).toEqual([
    "browser", "category", "commit", "fingerprint", "route",
    "source", "timestamp", "type", "v",
  ]);
  expect(report).toMatchObject({
    v: 1, category: "javascript", type: "TypeError", source: "window", route: "/options",
  });
  expect(request.postData()).not.toMatch(/0xSECRET|DO_NOT_SEND|wallet=/);

  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", {
      message: "another sensitive value",
      error: new TypeError("another sensitive value"),
      filename: location.origin + "/_next/static/chunks/app.js",
    }));
    window.dispatchEvent(new ErrorEvent("error", {
      message: "extension conflict",
      error: new TypeError("extension conflict"),
      filename: "chrome-extension://wallet/inpage.js",
    }));
  });
  await page.waitForTimeout(200);
  expect(reports).toHaveLength(1);
});

test("rejects oversized, malformed and cross-origin reports", async ({ page, request }) => {
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const endpoint = origin + "/api/client-errors";
  const crossOrigin = await request.post(endpoint, {
    headers: { origin: "https://unrelated.example", "content-type": "application/json" },
    data: "{}",
  });
  expect(crossOrigin.status()).toBe(403);
  const oversized = await request.post(endpoint, {
    headers: { origin, "content-type": "application/json" },
    data: JSON.stringify({ noise: "x".repeat(600) }),
  });
  expect(oversized.status()).toBe(413);
  const malformed = await request.post(endpoint, {
    headers: { origin, "content-type": "application/json" },
    data: JSON.stringify({ message: "0xSECRET", stack: "sensitive" }),
  });
  expect(malformed.status()).toBe(400);
});

test("limits accepted reports per function instance", async ({ page, request }) => {
  await page.goto("/");
  const reportRequest = page.waitForRequest((item) => item.url().endsWith("/api/client-errors"));
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", {
      error: new RangeError("synthetic"),
      filename: location.origin + "/_next/static/chunks/app.js",
    }));
  });
  const sample = await reportRequest;
  const origin = new URL(page.url()).origin;
  const statuses: number[] = [];
  for (let i = 0; i < 32; i++) {
    const response = await request.post(origin + "/api/client-errors", {
      headers: { origin, "content-type": "application/json" },
      data: sample.postData() ?? "",
    });
    statuses.push(response.status());
  }
  expect(statuses).toContain(429);
  expect(statuses.filter((status) => status === 204).length).toBeLessThanOrEqual(30);
});

test("report delivery failure never replaces the page", async ({ page }) => {
  await page.route("**/api/client-errors", (route) => route.abort());
  await page.goto("/custom");
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", {
      error: new ReferenceError("synthetic"),
      filename: location.origin + "/_next/static/chunks/app.js",
    }));
  });
  await expect(page.getByTestId("terminal-navbar")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
});
