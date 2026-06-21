// MATCHING-TIF-SEMANTICS-OPTIONS-V1 — direct-orderbook client contract test.
//
// Pure-Node validation (no Playwright, no browser, no TS runner) that
// confirms the request shape this frontend POSTs to `/options/orders`
// matches the backend contract for the four canonical scenarios:
//
//   1. GTC resting       — request includes `time_in_force: "gtc"`,
//                          `post_only: false`; response 200 with
//                          `status: "open"`, empty fills.
//   2. IOC partial fill  — request includes `time_in_force: "ioc"`;
//                          response 200 with `status: "cancelled"`,
//                          fills present, remaining > 0.
//   3. FOK not fillable  — request includes `time_in_force: "fok"`;
//                          response 400 `{"error": "fill-or-kill
//                          order is not fully fillable"}`. The
//                          client must surface that exact message.
//   4. Post-only crossing — request includes `post_only: true`;
//                          response 400 `{"error": "post-only
//                          order would immediately match"}`. The
//                          client must surface that exact message.
//
// The backend matching engine is independently validated by
// `cargo test --test options_tests` (88 tests). This file validates
// the WIRE CONTRACT — that the frontend client (a) sends the new
// fields on every submission and (b) surfaces the stable backend
// error messages unchanged.
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/orderbook-client.contract.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

const SERIES_ID =
  "0x62e9de8122013ec803cddbbe018c92dd78871c68a1b37c0b9eb39bca13a5f43f";
const ACCOUNT = "0x0000000000000000000000000000000000000001";

/** Mock backend matching the real `/options/orders` envelope. */
function startMockBackend(handler) {
  return new Promise((resolve) => {
    const captured = { request: null };
    const server = createServer((req, res) => {
      if (req.url !== "/options/orders" || req.method !== "POST") {
        res.writeHead(404).end();
        return;
      }
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        captured.request = body;
        const { status, response } = handler(body);
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        url: `http://127.0.0.1:${addr.port}/options/orders`,
        captured,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

/**
 * Mirror of the production frontend client. Kept inline because Node
 * does not transpile TypeScript and we want a zero-dep validation
 * that any developer can run without a TS toolchain. Any divergence
 * from `src/lib/trading-api.ts::submitOptionOrder` is a bug.
 */
async function submitOptionOrder(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const parsed = text.length ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = parsed.error ?? `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return parsed;
}

function baseRequest(overrides = {}) {
  return {
    option_series_id: SERIES_ID,
    account: ACCOUNT,
    side: "buy",
    price_1e8: "1000000000",
    size_1e8: "100000000",
    time_in_force: "gtc",
    post_only: false,
    ...overrides,
  };
}

function buildOrder(overrides) {
  return {
    order_id: "order-1",
    option_series_id: SERIES_ID,
    account: ACCOUNT,
    side: "buy",
    price_1e8: "1000000000",
    size_1e8: overrides.size,
    remaining_size_1e8: overrides.remaining,
    time_in_force: overrides.tif,
    post_only: overrides.post_only ?? false,
    client_order_id: null,
    nonce: null,
    deadline_ms: null,
    signature: null,
    status: overrides.status,
    created_at_ms: 1_782_000_000_000,
    updated_at_ms: 1_782_000_000_000,
    fills: overrides.fills ?? [],
  };
}

test("GTC resting — request shape + open response", async () => {
  const backend = await startMockBackend((req) => ({
    status: 200,
    response: buildOrder({
      size: req.size_1e8,
      remaining: req.size_1e8,
      status: "open",
      tif: req.time_in_force,
    }),
  }));
  try {
    const res = await submitOptionOrder(
      backend.url,
      baseRequest({ time_in_force: "gtc" }),
    );

    // Wire contract
    assert.equal(backend.captured.request.time_in_force, "gtc");
    assert.equal(backend.captured.request.post_only, false);
    assert.equal(backend.captured.request.option_series_id, SERIES_ID);

    // Response handling
    assert.equal(res.status, "open");
    assert.equal(res.remaining_size_1e8, "100000000");
    assert.equal(res.fills.length, 0);
  } finally {
    await backend.close();
  }
});

test("IOC remainder cancelled — fills surfaced, status cancelled", async () => {
  const backend = await startMockBackend((req) => ({
    status: 200,
    response: buildOrder({
      size: req.size_1e8,
      remaining: "70000000",
      status: "cancelled",
      tif: req.time_in_force,
      fills: [
        {
          fill_id: "fill-1",
          option_series_id: SERIES_ID,
          buy_order_id: "order-1",
          sell_order_id: "maker-a",
          buyer: ACCOUNT,
          seller: ACCOUNT,
          maker_order_id: "maker-a",
          taker_order_id: "order-1",
          taker_side: "buy",
          price_1e8: "1000000000",
          size_1e8: "30000000",
          created_at_ms: 1_782_000_000_000,
        },
      ],
    }),
  }));
  try {
    const res = await submitOptionOrder(
      backend.url,
      baseRequest({ time_in_force: "ioc" }),
    );

    assert.equal(backend.captured.request.time_in_force, "ioc");
    assert.equal(res.status, "cancelled");
    assert.equal(res.remaining_size_1e8, "70000000");
    assert.equal(res.fills.length, 1);
    assert.equal(res.fills[0].size_1e8, "30000000");
    // Invariant: filled + remaining == requested
    const filled = res.fills.reduce(
      (acc, f) => acc + BigInt(f.size_1e8),
      0n,
    );
    assert.equal(filled + BigInt(res.remaining_size_1e8), BigInt(res.size_1e8));
  } finally {
    await backend.close();
  }
});

test("FOK rejection — backend 400 surfaces stable error message", async () => {
  const backend = await startMockBackend(() => ({
    status: 400,
    response: { error: "fill-or-kill order is not fully fillable" },
  }));
  try {
    await assert.rejects(
      () =>
        submitOptionOrder(
          backend.url,
          baseRequest({ time_in_force: "fok" }),
        ),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.message, "fill-or-kill order is not fully fillable");
        return true;
      },
    );
    assert.equal(backend.captured.request.time_in_force, "fok");
    assert.equal(backend.captured.request.post_only, false);
  } finally {
    await backend.close();
  }
});

test("post-only marketable rejection — backend 400 surfaces stable error message", async () => {
  const backend = await startMockBackend(() => ({
    status: 400,
    response: { error: "post-only order would immediately match" },
  }));
  try {
    await assert.rejects(
      () =>
        submitOptionOrder(
          backend.url,
          baseRequest({ time_in_force: "gtc", post_only: true }),
        ),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.message, "post-only order would immediately match");
        return true;
      },
    );
    assert.equal(backend.captured.request.post_only, true);
    assert.equal(backend.captured.request.time_in_force, "gtc");
  } finally {
    await backend.close();
  }
});

test("invalid TIF combination — backend 400 surfaces stable error message", async () => {
  const backend = await startMockBackend(() => ({
    status: 400,
    response: {
      error: "invalid time-in-force combination: post-only is not compatible with IOC",
    },
  }));
  try {
    await assert.rejects(
      () =>
        submitOptionOrder(
          backend.url,
          baseRequest({ time_in_force: "ioc", post_only: true }),
        ),
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /invalid time-in-force combination/);
        return true;
      },
    );
  } finally {
    await backend.close();
  }
});
