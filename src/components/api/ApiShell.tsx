// FRONTEND-API-PAGE-V1 — developer reference for the public testnet
// beta API surface.
//
// This page documents:
//   1. Public HTTP/REST API
//   2. Public WebSocket API (GET /ws)
//   3. Wallet-authenticated private WebSocket account streams
//   4. Signed-intent trading flow
//   5. Separate MM WebTransport Gateway (operator-whitelisted only)
//
// No fabricated channels, no production URLs, no admin endpoints, no
// real-funds claims, no audit/mainnet language.

import { CodeBlock } from "./CodeBlock";
import { WsQuickTest } from "./WsQuickTest";

const HTTP_ENVELOPE_OK = `{
  "status": "ok",
  "data": {},
  "warnings": [],
  "meta": {
    "source": "backend",
    "chain_id": 84532,
    "request_id": "req_...",
    "generated_at_ms": 123456789
  }
}`;

const HTTP_ENVELOPE_ERR = `{
  "status": "error",
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Invalid EVM address.",
    "details": {}
  },
  "meta": {
    "source": "backend",
    "chain_id": 84532,
    "request_id": "req_...",
    "generated_at_ms": 123456789
  }
}`;

const WS_REQ_SUBSCRIBE = `{
  "jsonrpc": "2.0",
  "id": "req_1",
  "method": "subscribe",
  "params": {
    "channel": "trading.health"
  }
}`;

const WS_ACK_SUBSCRIBE = `{
  "jsonrpc": "2.0",
  "id": "req_1",
  "result": {
    "subscribed": true,
    "subscription_id": "sub_..."
  },
  "meta": {
    "source": "backend",
    "chain_id": 84532,
    "request_id": "req_...",
    "generated_at_ms": 123456789
  }
}`;

const WS_PUSH_EVENT = `{
  "jsonrpc": "2.0",
  "method": "subscription",
  "params": {
    "subscription_id": "sub_...",
    "channel": "trading.health",
    "seq": 0,
    "event_id": "evt_...",
    "generated_at_ms": 123456789,
    "data": {}
  }
}`;

const WS_AUTH_CHALLENGE_REQ = `{
  "jsonrpc": "2.0",
  "id": "auth_1",
  "method": "auth.challenge",
  "params": {
    "address": "0x..."
  }
}`;

const WS_AUTH_CHALLENGE_RES = `{
  "jsonrpc": "2.0",
  "id": "auth_1",
  "result": {
    "address": "0x...",
    "message": "DeOpt Public WebSocket Authentication\\n\\nAddress: 0x...\\nChain ID: 84532\\nNonce: nonce_...\\nIssued At: ...\\nExpires At: ...\\nDomain: deopt-v2-public-ws",
    "expires_at_ms": 123456789
  }
}`;

const WS_AUTH_VERIFY_REQ = `{
  "jsonrpc": "2.0",
  "id": "auth_2",
  "method": "auth.verify",
  "params": {
    "address": "0x...",
    "signature": "0x..."
  }
}`;

const WS_AUTH_VERIFY_RES = `{
  "jsonrpc": "2.0",
  "id": "auth_2",
  "result": {
    "authenticated": true,
    "address": "0x..."
  }
}`;

const CANONICAL_MESSAGE = `DeOpt Public WebSocket Authentication

Address: <lower-case 0x...>
Chain ID: <u64>
Nonce: nonce_<uuid>
Issued At: <i64 ms>
Expires At: <i64 ms>
Domain: deopt-v2-public-ws`;

const CURL_EXAMPLE = `curl https://<deopt-api-host>/trading/health`;

const JS_WS_SUBSCRIBE = `const ws = new WebSocket("wss://<deopt-api-host>/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: "req_1",
    method: "subscribe",
    params: { channel: "trading.health" }
  }));
};

ws.onmessage = (event) => {
  console.log(JSON.parse(event.data));
};`;

const JS_WS_AUTH = `// 1. Ask the server for a canonical challenge bound to this address.
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: "auth_1",
  method: "auth.challenge",
  params: { address }
}));

// 2. The server replies with result.message — the EXACT bytes to sign.
//    Any whitespace, casing, or chain-id change will recover a
//    different address and the server will return AUTH_ADDRESS_MISMATCH.
const signature = await window.ethereum.request({
  method: "personal_sign",
  params: [message, address]
});

// 3. Submit the recovered signature.
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: "auth_2",
  method: "auth.verify",
  params: { address, signature }
}));`;

const JS_WS_PRIVATE_SUB = `ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: "sub_positions",
  method: "subscribe",
  params: { channel: "account.positions" }
}));`;

const SIGNED_INTENT_FLOW = `1. Client prepares an order.
2. Client requests an execution intent over HTTP.
3. Wallet signs the typed-data payload returned by the backend.
4. The signed payload is submitted back to the backend / executor.
5. Executor broadcasts only signed, validated payloads.
6. WebSocket account streams report positions, balances, history,
   and status as the underlying sources mature.`;

interface HttpEndpoint {
  method: "GET" | "POST";
  path: string;
  purpose: string;
  auth: "Public" | "Wallet signature flow";
  status: "Live" | "Beta";
}

const HTTP_ENDPOINTS: HttpEndpoint[] = [
  {
    method: "GET",
    path: "/trading/health",
    purpose: "Backend / executor / indexer health.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/options/products",
    purpose: "List option products.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "POST",
    path: "/options/products/batch",
    purpose: "Resolve a batch of product ids.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/options/products/{product_id}",
    purpose: "Single product detail.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/options/series/{series_id}/details",
    purpose: "Series detail incl. expiry / strikes.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "POST",
    path: "/options/quotes/preview",
    purpose: "Preview a quote for an option order.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "POST",
    path: "/options/exercise/preview",
    purpose: "Preview an exercise.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "POST",
    path: "/options/close/preview",
    purpose: "Preview a close.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "POST",
    path: "/options/execution-intents",
    purpose: "Create a signed execution intent.",
    auth: "Wallet signature flow",
    status: "Live",
  },
  {
    method: "GET",
    path: "/accounts/{address}/positions",
    purpose: "Open positions for the account.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/accounts/{address}/portfolio",
    purpose: "Account portfolio summary.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/accounts/{address}/balances",
    purpose: "Account balances by token.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/accounts/{address}/history",
    purpose: "Legacy history feed.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/accounts/{address}/history/v2",
    purpose: "Paginated trades / settlements / actions history.",
    auth: "Public",
    status: "Live",
  },
  {
    method: "GET",
    path: "/leaderboard",
    purpose: "Global ranking by trading volume.",
    auth: "Public",
    status: "Live",
  },
];

const ERROR_CODES: Array<{ code: string; meaning: string }> = [
  { code: "INVALID_ADDRESS", meaning: "EVM address failed to parse." },
  { code: "INVALID_REQUEST", meaning: "Malformed JSON or missing fields." },
  { code: "AUTH_REQUIRED", meaning: "Endpoint or channel requires a wallet-authenticated session." },
  { code: "AUTH_EXPIRED", meaning: "Wallet challenge expired before verify." },
  { code: "AUTH_INVALID_SIGNATURE", meaning: "Signature failed to recover a valid signer." },
  { code: "AUTH_ADDRESS_MISMATCH", meaning: "Recovered signer or subscribe address mismatches the bound session." },
  { code: "SOURCE_UNAVAILABLE", meaning: "Backing source returned an error or is not yet wired." },
  { code: "INTERNAL_ERROR", meaning: "Server-side fault — retry, then report if it persists." },
];

const WS_METHODS: Array<{ method: string; direction: string; purpose: string }> = [
  { method: "ping", direction: "client → server", purpose: "Liveness check; server replies with server-time + chain id." },
  { method: "subscribe", direction: "client → server", purpose: "Subscribe to a channel; first snapshot is pushed immediately." },
  { method: "unsubscribe", direction: "client → server", purpose: "Remove a subscription by id." },
  { method: "subscriptions", direction: "client → server", purpose: "List active subscriptions on this connection." },
  { method: "session.get", direction: "client → server", purpose: "Return session id, auth state, bound address, subscriptions." },
  { method: "auth.challenge", direction: "client → server", purpose: "Issue a single-use challenge + canonical message." },
  { method: "auth.verify", direction: "client → server", purpose: "Recover the EIP-191 signer and bind the session to the address." },
  { method: "subscription", direction: "server → client", purpose: "Push frame (snapshot or periodic update)." },
];

interface WsChannel {
  name: string;
  status: "Live" | "Deferred" | "Reserved";
  source: string;
}

const PUBLIC_WS_CHANNELS: WsChannel[] = [
  { name: "trading.health", status: "Live", source: "/trading/health" },
  { name: "options.products", status: "Live", source: "/options/products" },
  { name: "leaderboard", status: "Live", source: "/leaderboard" },
];

const DEFERRED_WS_CHANNELS: WsChannel[] = [
  { name: "options.orderbook", status: "Deferred", source: "no public source yet" },
  { name: "options.trades", status: "Deferred", source: "no public source yet" },
  { name: "options.ticker", status: "Deferred", source: "no public source yet" },
  { name: "oracle.price", status: "Deferred", source: "no public source yet" },
  { name: "mark.price", status: "Deferred", source: "no public source yet" },
];

const PRIVATE_WS_CHANNELS: WsChannel[] = [
  { name: "account.positions", status: "Live", source: "account_positions HTTP handler" },
  { name: "account.portfolio", status: "Live", source: "account_portfolio HTTP handler" },
  { name: "account.balances", status: "Live", source: "account_balances HTTP handler" },
  { name: "account.history", status: "Live", source: "account_history_v2 (tab=trades, last_month)" },
  { name: "account.orders", status: "Reserved", source: "honest empty array" },
  { name: "account.fills", status: "Reserved", source: "honest empty array" },
  { name: "account.intent_status", status: "Reserved", source: "honest empty array" },
  { name: "account.settlements", status: "Reserved", source: "honest empty array" },
  { name: "account.liquidations", status: "Reserved", source: "honest empty array" },
];

interface UserProfile {
  id: string;
  label: string;
  transport: string;
  auth: string;
  capabilities: string;
  restrictions: string;
}

const PROFILES: UserProfile[] = [
  {
    id: "human",
    label: "Public human user",
    transport: "HTTP + public/private WebSocket",
    auth: "Wallet connect + gas-free EIP-191 auth signature",
    capabilities: "Read public data, view account streams, sign trading intents",
    restrictions: "No MM privileges",
  },
  {
    id: "bot",
    label: "Advanced trader / bot",
    transport: "HTTP + private WebSocket",
    auth: "Wallet; future optional session-key automation",
    capabilities: "Automate own account, batch reads, replay safe REST flows",
    restrictions: "No MM bulk / RFQ unless operator-whitelisted",
  },
  {
    id: "mm",
    label: "Operator-whitelisted MM",
    transport: "Separate WebTransport Gateway (QUIC / HTTP3)",
    auth: "Wallet challenge / session key + operator permissions",
    capabilities: "Bulk submit, quote replace, option / perp RFQ, cancel-on-disconnect",
    restrictions: "Permission-gated; off by default; not exposed publicly",
  },
];

function statusChipClass(status: WsChannel["status"]): string {
  if (status === "Live")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "Deferred")
    return "border-zinc-700 bg-zinc-900 text-zinc-400";
  return "border-zinc-800 bg-black/40 text-zinc-300";
}

function statusHttpChipClass(status: HttpEndpoint["status"]): string {
  if (status === "Live")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export function ApiShell() {
  return (
    <div
      data-testid="api-shell"
      className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4 overflow-y-auto bg-black p-4 text-zinc-200"
    >
      {/* 1. Hero */}
      <header
        data-testid="api-hero"
        className="flex flex-col gap-3 border-b border-zinc-900 pb-4"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          API
        </h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-zinc-400">
          Public HTTP, WebSocket streams, wallet-authenticated account data,
          and a separate MM gateway for operator-whitelisted market makers.
        </p>
        <div
          data-testid="api-hero-chips"
          className="flex flex-wrap items-center gap-1.5"
        >
          {[
            "Public HTTP",
            "Public WebSocket",
            "Wallet Auth",
            "MM WebTransport",
            "Testnet Beta",
          ].map((c) => (
            <span
              key={c}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-200"
            >
              {c}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">
          Base Sepolia testnet beta. Unaudited. No real funds. Mainnet
          disabled.
        </p>
      </header>

      {/* 2. Architecture overview */}
      <section
        data-testid="api-architecture"
        aria-labelledby="api-architecture-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-architecture-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Architecture overview
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ArchCard
            tag="A"
            title="Public HTTP"
            points={[
              "snapshots",
              "products / series / previews",
              "positions / portfolio / balances",
              "history / leaderboard",
              "signed intent creation",
            ]}
          />
          <ArchCard
            tag="B"
            title="Public WebSocket"
            points={[
              "live subscriptions",
              "health / products / leaderboard now",
              "future market-data deltas",
              "wallet-authenticated account streams",
            ]}
          />
          <ArchCard
            tag="C"
            title="Signed Intents"
            points={[
              "create intent",
              "wallet signs typed payload",
              "executor broadcasts signed intent",
              "backend never signs for the user",
            ]}
          />
          <ArchCard
            tag="D"
            title="MM Gateway"
            points={[
              "operator-whitelisted MMs only",
              "WebTransport / QUIC / HTTP3",
              "bulk submit / cancel",
              "RFQ quoting, quote replace",
              "cancel-on-disconnect",
            ]}
          />
        </div>
      </section>

      {/* 3. Public HTTP API */}
      <section
        data-testid="api-http"
        aria-labelledby="api-http-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-http-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Public HTTP API
        </h2>
        <div className="rounded-md border border-zinc-900 bg-zinc-950 p-3 text-[12px]">
          <p className="text-zinc-300">
            Base URL is environment-configurable. Examples below use the
            placeholder <code className="rounded bg-black/60 px-1 text-emerald-200">{"https://<deopt-api-host>"}</code>;
            local backend defaults to{" "}
            <code className="rounded bg-black/60 px-1 text-emerald-200">
              http://localhost:8080
            </code>
            .
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Admin endpoints are not part of the public API and are never held
            by the frontend.
          </p>
        </div>

        <div className="overflow-hidden rounded-md border border-zinc-900">
          <table
            data-testid="api-http-endpoint-table"
            className="w-full min-w-full border-separate border-spacing-0 font-mono text-[12px]"
            style={{ fontFamily: "var(--app-font-mono)" }}
          >
            <thead className="bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Method
                </th>
                <th className="border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Path
                </th>
                <th className="border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Purpose
                </th>
                <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Auth
                </th>
                <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {HTTP_ENDPOINTS.map((ep) => (
                <tr
                  key={`${ep.method} ${ep.path}`}
                  data-testid={`api-http-row-${ep.method}-${ep.path}`}
                  className="hover:bg-zinc-900/40"
                >
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5 text-emerald-300">
                    {ep.method}
                  </td>
                  <td className="border-b border-zinc-900 px-3 py-1.5 text-zinc-100">
                    {ep.path}
                  </td>
                  <td
                    className="border-b border-zinc-900 px-3 py-1.5 text-zinc-400"
                    style={{ fontFamily: "var(--app-font-sans)" }}
                  >
                    {ep.purpose}
                  </td>
                  <td
                    className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5 text-zinc-300"
                    style={{ fontFamily: "var(--app-font-sans)" }}
                  >
                    {ep.auth}
                  </td>
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${statusHttpChipClass(ep.status)}`}
                      style={{ fontFamily: "var(--app-font-sans)" }}
                    >
                      {ep.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Response envelope
            </span>
            <CodeBlock
              testid="api-http-envelope-ok"
              language="json"
              label="200 OK"
              code={HTTP_ENVELOPE_OK}
            />
          </div>
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Error envelope
            </span>
            <CodeBlock
              testid="api-http-envelope-err"
              language="json"
              label="ERROR"
              code={HTTP_ENVELOPE_ERR}
            />
          </div>
        </div>

        <div className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
          <span className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Common error codes
          </span>
          <ul
            data-testid="api-http-error-codes"
            className="mt-2 grid gap-x-3 gap-y-1 text-[12px] sm:grid-cols-2"
          >
            {ERROR_CODES.map((e) => (
              <li
                key={e.code}
                className="flex items-baseline gap-2"
              >
                <code
                  className="rounded border border-zinc-800 bg-black/40 px-1.5 text-emerald-200"
                  style={{ fontFamily: "var(--app-font-mono)" }}
                >
                  {e.code}
                </code>
                <span className="text-zinc-400">{e.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Public WebSocket */}
      <section
        data-testid="api-ws"
        aria-labelledby="api-ws-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-ws-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Public WebSocket
        </h2>
        <div className="rounded-md border border-zinc-900 bg-zinc-950 p-3 text-[12px] text-zinc-300">
          <p>
            Browser-compatible WebSocket at{" "}
            <code className="rounded bg-black/60 px-1 text-emerald-200">
              GET /ws
            </code>{" "}
            on the same listener as the public HTTP API. JSON-RPC 2.0 wire
            shape with a <code className="rounded bg-black/60 px-1 text-emerald-200">meta</code>{" "}
            block that mirrors the HTTP envelope (
            <code className="rounded bg-black/60 px-1 text-zinc-200">source</code>,{" "}
            <code className="rounded bg-black/60 px-1 text-zinc-200">chain_id</code>,{" "}
            <code className="rounded bg-black/60 px-1 text-zinc-200">request_id</code>,{" "}
            <code className="rounded bg-black/60 px-1 text-zinc-200">generated_at_ms</code>).
          </p>
          <p className="mt-2 text-zinc-400">
            Public and private subscriptions live on the same connection.
            Private account streams require wallet authentication first. The
            public WebSocket does not accept order submission in V1; signed
            intent creation stays on HTTP.
          </p>
        </div>

        <div className="overflow-hidden rounded-md border border-zinc-900">
          <table
            data-testid="api-ws-method-table"
            className="w-full min-w-full border-separate border-spacing-0 font-mono text-[12px]"
            style={{ fontFamily: "var(--app-font-mono)" }}
          >
            <thead className="bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Method
                </th>
                <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Direction
                </th>
                <th className="border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Purpose
                </th>
              </tr>
            </thead>
            <tbody>
              {WS_METHODS.map((m) => (
                <tr key={m.method} className="hover:bg-zinc-900/40">
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5 text-emerald-200">
                    {m.method}
                  </td>
                  <td
                    className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5 text-zinc-400"
                    style={{ fontFamily: "var(--app-font-sans)" }}
                  >
                    {m.direction}
                  </td>
                  <td
                    className="border-b border-zinc-900 px-3 py-1.5 text-zinc-300"
                    style={{ fontFamily: "var(--app-font-sans)" }}
                  >
                    {m.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 xl:grid-cols-3">
          <CodeBlock
            testid="api-ws-req-subscribe"
            language="json"
            label="Client → subscribe"
            code={WS_REQ_SUBSCRIBE}
          />
          <CodeBlock
            testid="api-ws-ack-subscribe"
            language="json"
            label="Server → ack"
            code={WS_ACK_SUBSCRIBE}
          />
          <CodeBlock
            testid="api-ws-push"
            language="json"
            label="Server → push"
            code={WS_PUSH_EVENT}
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <ChannelTable
            testid="api-ws-public-channels"
            title="Public channels — live"
            rows={PUBLIC_WS_CHANNELS}
          />
          <ChannelTable
            testid="api-ws-deferred-channels"
            title="Deferred — no fabricated data"
            rows={DEFERRED_WS_CHANNELS}
          />
        </div>
      </section>

      {/* 5. Wallet auth */}
      <section
        data-testid="api-auth"
        aria-labelledby="api-auth-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-auth-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Wallet authentication
        </h2>
        <ol
          data-testid="api-auth-flow"
          className="rounded-md border border-zinc-900 bg-zinc-950 p-3 text-[12px] text-zinc-300"
        >
          <li>
            <span className="text-emerald-200">1.</span>{" "}
            <code className="rounded bg-black/60 px-1 text-emerald-200">
              auth.challenge
            </code>{" "}
            — client sends the wallet address.
          </li>
          <li>
            <span className="text-emerald-200">2.</span> Backend returns the
            full canonical{" "}
            <code className="rounded bg-black/60 px-1 text-zinc-200">message</code>{" "}
            field.
          </li>
          <li>
            <span className="text-emerald-200">3.</span> Wallet signs the
            exact message bytes (EIP-191 personal-sign).
          </li>
          <li>
            <span className="text-emerald-200">4.</span>{" "}
            <code className="rounded bg-black/60 px-1 text-emerald-200">
              auth.verify
            </code>{" "}
            with the recovered signature.
          </li>
          <li>
            <span className="text-emerald-200">5.</span> Session is bound to
            the recovered, lower-cased address.
          </li>
          <li>
            <span className="text-emerald-200">6.</span> Private{" "}
            <code className="rounded bg-black/60 px-1 text-emerald-200">
              account.*
            </code>{" "}
            channels become available — for that address only.
          </li>
        </ol>

        <div className="grid gap-2 xl:grid-cols-2">
          <CodeBlock
            testid="api-auth-challenge-req"
            language="json"
            label="auth.challenge — request"
            code={WS_AUTH_CHALLENGE_REQ}
          />
          <CodeBlock
            testid="api-auth-challenge-res"
            language="json"
            label="auth.challenge — response"
            code={WS_AUTH_CHALLENGE_RES}
          />
          <CodeBlock
            testid="api-auth-verify-req"
            language="json"
            label="auth.verify — request"
            code={WS_AUTH_VERIFY_REQ}
          />
          <CodeBlock
            testid="api-auth-verify-res"
            language="json"
            label="auth.verify — response"
            code={WS_AUTH_VERIFY_RES}
          />
        </div>

        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Canonical message — byte-for-byte
          </span>
          <CodeBlock
            testid="api-auth-canonical"
            language="text"
            label="Signed message"
            code={CANONICAL_MESSAGE}
          />
        </div>

        <p
          data-testid="api-auth-warning"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12px] text-emerald-100"
        >
          The wallet must sign the exact{" "}
          <code className="rounded bg-black/40 px-1 text-emerald-200">
            message
          </code>{" "}
          field returned by{" "}
          <code className="rounded bg-black/40 px-1 text-emerald-200">
            auth.challenge
          </code>
          . Whitespace, casing, or chain-id changes invalidate the signature.
        </p>
      </section>

      {/* 6. Private account streams */}
      <section
        data-testid="api-private-channels"
        aria-labelledby="api-private-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-private-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Private account streams
        </h2>
        <ChannelTable
          testid="api-private-channel-table"
          title="account.* channels"
          rows={PRIVATE_WS_CHANNELS}
        />
        <ul className="rounded-md border border-zinc-900 bg-zinc-950 p-3 text-[12px] text-zinc-300">
          <li>Private channels are address-bound to the authenticated session.</li>
          <li>
            <code className="rounded bg-black/60 px-1 text-zinc-200">
              params.address
            </code>{" "}
            cannot override the authenticated session address — mismatch
            returns{" "}
            <code className="rounded bg-black/60 px-1 text-emerald-200">
              AUTH_ADDRESS_MISMATCH
            </code>
            .
          </li>
          <li>No other wallet&apos;s data can be queried through a bound session.</li>
        </ul>
      </section>

      {/* 7. Signed Intent flow */}
      <section
        data-testid="api-intents"
        aria-labelledby="api-intents-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-intents-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Signed intent trading flow
        </h2>
        <CodeBlock
          testid="api-intent-flow"
          language="text"
          label="Trading flow"
          code={SIGNED_INTENT_FLOW}
        />
        <ul className="rounded-md border border-zinc-900 bg-zinc-950 p-3 text-[12px] text-zinc-300">
          <li>The backend never signs on behalf of the user.</li>
          <li>The public API never exposes an admin bearer.</li>
          <li>No mainnet. No real-funds claim.</li>
          <li>
            WebSocket order submission is not live in V1. Intent creation
            stays on HTTP (
            <code className="rounded bg-black/60 px-1 text-emerald-200">
              POST /options/execution-intents
            </code>
            ).
          </li>
        </ul>
      </section>

      {/* 8. MM Gateway */}
      <section
        data-testid="api-mm-gateway"
        aria-labelledby="api-mm-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-mm-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          MM Gateway — operator-whitelisted only
        </h2>
        <div className="grid gap-2 lg:grid-cols-2">
          <ul className="rounded-md border border-zinc-900 bg-zinc-950 p-3 text-[12px] text-zinc-300">
            <li>Separate from the public WebSocket.</li>
            <li>WebTransport over QUIC / HTTP3.</li>
            <li>
              Default separate listener{" "}
              <code className="rounded bg-black/60 px-1 text-emerald-200">
                :8443
              </code>
              .
            </li>
            <li>TLS required.</li>
            <li>Off by default.</li>
            <li>Permission-gated, for market makers only.</li>
          </ul>
          <ul className="rounded-md border border-zinc-900 bg-zinc-950 p-3 text-[12px] text-zinc-300">
            <li>Bulk submit</li>
            <li>Bulk cancel / cancel all</li>
            <li>Quote replace</li>
            <li>Option RFQ quote</li>
            <li>Perp RFQ quote</li>
            <li>Cancel-on-disconnect</li>
          </ul>
        </div>
        <ul
          data-testid="api-mm-explicit"
          className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-[12px] text-emerald-100"
        >
          <li>The public API does not expose WebTransport.</li>
          <li>The MM Gateway is not a public WebSocket API.</li>
          <li>Normal users and bots use HTTP + public/private WebSocket.</li>
          <li>
            Operator-whitelisted market makers use the separate WebTransport
            gateway.
          </li>
        </ul>
      </section>

      {/* 9. User profiles */}
      <section
        data-testid="api-profiles"
        aria-labelledby="api-profiles-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-profiles-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          User profiles
        </h2>
        <div className="overflow-hidden rounded-md border border-zinc-900">
          <table
            data-testid="api-profile-table"
            className="w-full min-w-full border-separate border-spacing-0 text-[12px]"
          >
            <thead className="bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Profile
                </th>
                <th className="border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Transport
                </th>
                <th className="border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Auth
                </th>
                <th className="border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Capabilities
                </th>
                <th className="border-b border-zinc-900 px-3 py-2 text-left font-medium">
                  Restrictions
                </th>
              </tr>
            </thead>
            <tbody>
              {PROFILES.map((p) => (
                <tr
                  key={p.id}
                  data-testid={`api-profile-row-${p.id}`}
                  className="hover:bg-zinc-900/40"
                >
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-zinc-100">
                    {p.label}
                  </td>
                  <td className="border-b border-zinc-900 px-3 py-2 text-zinc-300">
                    {p.transport}
                  </td>
                  <td className="border-b border-zinc-900 px-3 py-2 text-zinc-300">
                    {p.auth}
                  </td>
                  <td className="border-b border-zinc-900 px-3 py-2 text-zinc-300">
                    {p.capabilities}
                  </td>
                  <td className="border-b border-zinc-900 px-3 py-2 text-zinc-400">
                    {p.restrictions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 10. Code examples */}
      <section
        data-testid="api-examples"
        aria-labelledby="api-examples-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="api-examples-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Code examples
        </h2>
        <div className="grid gap-2 lg:grid-cols-2">
          <CodeBlock
            testid="api-example-curl"
            language="bash"
            label="curl"
            code={CURL_EXAMPLE}
          />
          <CodeBlock
            testid="api-example-ws-subscribe"
            language="javascript"
            label="Browser — subscribe"
            code={JS_WS_SUBSCRIBE}
          />
          <CodeBlock
            testid="api-example-ws-auth"
            language="javascript"
            label="Browser — wallet auth"
            code={JS_WS_AUTH}
          />
          <CodeBlock
            testid="api-example-ws-private"
            language="javascript"
            label="Private subscribe"
            code={JS_WS_PRIVATE_SUB}
          />
        </div>
      </section>

      {/* 11. WS Quick Test */}
      <section
        data-testid="api-quick-test"
        aria-labelledby="api-quick-test-heading"
        className="flex flex-col gap-2 pb-6"
      >
        <h2
          id="api-quick-test-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
        >
          Live WebSocket sandbox
        </h2>
        <WsQuickTest />
      </section>
    </div>
  );
}

function ArchCard({
  tag,
  title,
  points,
}: {
  tag: string;
  title: string;
  points: string[];
}) {
  return (
    <div
      data-testid={`api-arch-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className="flex flex-col gap-2 rounded-md border border-zinc-900 bg-zinc-950 p-3"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-semibold text-emerald-200">
          {tag}
        </span>
        <span className="text-[13px] font-semibold text-zinc-100">{title}</span>
      </div>
      <ul className="space-y-0.5 text-[12px] text-zinc-400">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-zinc-600">·</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChannelTable({
  testid,
  title,
  rows,
}: {
  testid: string;
  title: string;
  rows: WsChannel[];
}) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-900">
      <div className="border-b border-zinc-900 bg-zinc-950 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
          {title}
        </span>
      </div>
      <table
        data-testid={testid}
        className="w-full min-w-full border-separate border-spacing-0 font-mono text-[12px]"
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        <thead className="bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          <tr>
            <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5 text-left font-medium">
              Channel
            </th>
            <th className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5 text-left font-medium">
              Status
            </th>
            <th className="border-b border-zinc-900 px-3 py-1.5 text-left font-medium">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-zinc-900/40">
              <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5 text-zinc-100">
                {r.name}
              </td>
              <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-1.5">
                <span
                  className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${statusChipClass(r.status)}`}
                  style={{ fontFamily: "var(--app-font-sans)" }}
                >
                  {r.status}
                </span>
              </td>
              <td
                className="border-b border-zinc-900 px-3 py-1.5 text-zinc-400"
                style={{ fontFamily: "var(--app-font-sans)" }}
              >
                {r.source}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
