// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — production lifecycle WebSocket client.
//
// Connects to the backend `/ws` endpoint, performs the EIP-191
// challenge/verify handshake, subscribes to the three account
// lifecycle channels, and emits typed `LifecycleEvent`s to a callback.
//
// Wire protocol — anchored to `~/DEOPT/deopt-v2-backend/src/api/public_ws/`:
//
//   →  { "jsonrpc":"2.0", "id":<n>, "method":"auth.challenge",
//        "params":{ "address":"0x…" } }
//   ←  { result: { nonce, message, expires_at_ms, chain_id, ... }, meta }
//   →  { "jsonrpc":"2.0", "id":<n>, "method":"auth.verify",
//        "params":{ "address":"0x…", "signature":"0x…" } }
//   ←  { result: { authenticated: true, ... }, meta }
//   →  { "jsonrpc":"2.0", "id":<n>, "method":"subscribe",
//        "params":{ "channel":"account.orders", "address":"0x…" } }     (×3)
//   ←  { result: { subscription_id, ... }, meta }
//   ←  { method:"subscription", params:{ ..., data:{ type:"lifecycle_delta", payload } } }
//
// Reconnect strategy: exponential backoff (1s → 2s → 4s → 8s → max 30s),
// with a `onResync` callback fired after a successful re-subscribe so
// the consumer can refetch REST snapshots and bridge any missed deltas.

import { parseLifecycleFrame } from "./lifecycle-parse";
import type {
  LifecycleConnectionStatus,
  LifecycleEvent,
} from "./lifecycle-types";
import { tradingApiBaseUrl } from "./trading-api";

const SUBSCRIBE_CHANNELS = [
  "account.orders",
  "account.fills",
  "account.conditional_orders",
] as const;

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export type SignMessageFn = (
  message: string,
) => Promise<
  | { ok: true; signature: `0x${string}` }
  | { ok: false; reason: string; message?: string }
>;

export interface LifecycleWsClientArgs {
  /** Authenticated account this client is for (lowercase). */
  address: string;
  /** Wallet personal-sign function (EIP-191). */
  signMessage: SignMessageFn;
  /** Called for every parsed lifecycle delta. */
  onEvent: (event: LifecycleEvent) => void;
  /** Called whenever the connection status changes. */
  onStatus: (status: LifecycleConnectionStatus, detail?: string) => void;
  /**
   * Called after a successful (re)subscribe completes — the consumer
   * MUST refetch REST snapshots to bridge any missed deltas. Fires on
   * first-time subscribe AND on every reconnect-resubscribe.
   */
  onResync: () => void;
}

/** Resolve the `/ws` URL from the same env vars used by the sandbox. */
function resolveWsUrl(): string {
  if (typeof process !== "undefined") {
    const explicit = process.env.NEXT_PUBLIC_PUBLIC_WS_URL;
    if (explicit && explicit.length > 0) return explicit;
  }
  const base = tradingApiBaseUrl();
  if (base.startsWith("https://")) return `${base.replace(/^https:\/\//, "wss://")}/ws`;
  if (base.startsWith("http://")) return `${base.replace(/^http:\/\//, "ws://")}/ws`;
  return "ws://localhost:8080/ws";
}

export class LifecycleWsClient {
  private socket: WebSocket | null = null;
  private status: LifecycleConnectionStatus = "disconnected";
  private nextReqId = 1;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private seenEventIds = new Set<string>();
  private subscriptionIds = new Set<string>();

  constructor(private readonly args: LifecycleWsClientArgs) {}

  start(): void {
    this.disposed = false;
    this.connect();
  }

  stop(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket("client_stop");
    this.setStatus("disconnected");
  }

  private setStatus(s: LifecycleConnectionStatus, detail?: string): void {
    this.status = s;
    try {
      this.args.onStatus(s, detail);
    } catch {
      // Caller's status handler is best-effort.
    }
  }

  private connect(): void {
    if (this.disposed) return;
    const url = resolveWsUrl();
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect("ws_construct_failed");
      this.setStatus(
        "error",
        `failed to open WebSocket: ${(e as Error).message}`,
      );
      return;
    }
    this.socket = ws;
    this.setStatus("connecting");

    ws.addEventListener("open", () => {
      void this.runAuthThenSubscribe();
    });
    ws.addEventListener("close", (ev) => {
      this.handleClose(ev.code, ev.reason || "ws_closed");
    });
    ws.addEventListener("error", () => {
      // The `close` event will fire right after; reconnect schedules there.
    });
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string") return;
      this.handleFrame(ev.data);
    });
  }

  private closeSocket(reason: string): void {
    if (!this.socket) return;
    try {
      this.socket.close(1000, reason);
    } catch {
      // ignore
    }
    this.socket = null;
  }

  private handleClose(code: number, reason: string): void {
    this.socket = null;
    this.subscriptionIds.clear();
    if (this.disposed) {
      this.setStatus("disconnected");
      return;
    }
    this.scheduleReconnect(`close:${code}:${reason}`);
  }

  private scheduleReconnect(reason: string): void {
    if (this.disposed) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const backoff = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_MIN_MS * Math.pow(2, Math.min(5, this.reconnectAttempt - 1)),
    );
    this.setStatus("reconnecting", `${reason} (retry in ${backoff}ms)`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoff);
  }

  private async runAuthThenSubscribe(): Promise<void> {
    this.setStatus("authenticating");
    let challengeResult: { nonce: string; message: string } | null = null;
    try {
      const resp = await this.request("auth.challenge", {
        address: this.args.address,
      });
      const result = resp?.result as
        | { nonce?: unknown; message?: unknown }
        | undefined;
      const nonce = result?.nonce;
      const message = result?.message;
      if (typeof nonce !== "string" || typeof message !== "string") {
        throw new Error("auth.challenge response missing nonce/message");
      }
      challengeResult = { nonce, message };
    } catch (e) {
      this.setStatus("error", `auth.challenge failed: ${(e as Error).message}`);
      this.closeSocket("auth_challenge_failed");
      this.scheduleReconnect("auth_challenge_failed");
      return;
    }

    const signed = await this.args.signMessage(challengeResult.message);
    if (!signed.ok) {
      // User rejected, wrong network, no provider — back off but DO NOT
      // hammer the wallet. We surface the status and rely on the
      // consumer to re-trigger by reconnecting (e.g. wallet event).
      this.setStatus(
        "error",
        `wallet refused to sign WS auth challenge: ${signed.reason}`,
      );
      this.closeSocket("wallet_refused_signature");
      // Schedule a slower reconnect so we don't immediately prompt again.
      this.reconnectAttempt = Math.max(this.reconnectAttempt, 4);
      this.scheduleReconnect("wallet_refused_signature");
      return;
    }

    try {
      const verifyResp = await this.request("auth.verify", {
        address: this.args.address,
        signature: signed.signature,
      });
      if (verifyResp?.error) {
        throw new Error(
          `auth.verify rejected: ${
            (verifyResp.error as { code?: string; message?: string }).code ??
            "UNKNOWN"
          }`,
        );
      }
    } catch (e) {
      this.setStatus("error", `auth.verify failed: ${(e as Error).message}`);
      this.closeSocket("auth_verify_failed");
      this.scheduleReconnect("auth_verify_failed");
      return;
    }

    // Subscribe to all three lifecycle channels.
    for (const channel of SUBSCRIBE_CHANNELS) {
      try {
        const resp = await this.request("subscribe", {
          channel,
          address: this.args.address,
        });
        const subId = (resp?.result as { subscription_id?: unknown } | undefined)
          ?.subscription_id;
        if (typeof subId === "string") {
          this.subscriptionIds.add(subId);
        }
      } catch (e) {
        // One failed subscribe doesn't tear down the whole connection;
        // surface as a status detail and continue with the others.
        this.setStatus(
          "error",
          `subscribe(${channel}) failed: ${(e as Error).message}`,
        );
      }
    }

    // Reset backoff after a successful authenticated subscribe.
    this.reconnectAttempt = 0;
    this.setStatus("subscribed");
    try {
      this.args.onResync();
    } catch {
      // Caller's resync handler is best-effort.
    }
  }

  /**
   * Send a JSON-RPC request and resolve with the matching response.
   * Rejects on `null` / non-object responses or on socket close.
   */
  private request(method: string, params: unknown): Promise<{
    id?: unknown;
    result?: unknown;
    error?: unknown;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("socket not open"));
        return;
      }
      const id = this.nextReqId++;
      const matcher = (ev: MessageEvent) => {
        if (typeof ev.data !== "string") return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (
          parsed &&
          typeof parsed === "object" &&
          (parsed as { id?: unknown }).id === id
        ) {
          this.socket?.removeEventListener("message", matcher);
          resolve(parsed as { id?: unknown; result?: unknown; error?: unknown });
        }
      };
      this.socket.addEventListener("message", matcher);
      try {
        this.socket.send(
          JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        );
      } catch (e) {
        this.socket?.removeEventListener("message", matcher);
        reject(e as Error);
      }
      // 10 s request timeout — safety net so a silent server doesn't
      // pin the auth/subscribe step forever.
      setTimeout(() => {
        this.socket?.removeEventListener("message", matcher);
        reject(new Error(`${method} timed out`));
      }, 10_000);
    });
  }

  private handleFrame(raw: string): void {
    const event = parseLifecycleFrame(raw);
    if (!event) return;
    // Dedupe by event_id (primary) — backend assigns a fresh uuid per
    // push so this is monotonically unique.
    if (this.seenEventIds.has(event.event_id)) return;
    this.seenEventIds.add(event.event_id);
    // Bound the seen-set so it doesn't grow unbounded over a long session.
    if (this.seenEventIds.size > 4096) {
      const drop = Math.floor(this.seenEventIds.size / 4);
      let i = 0;
      for (const id of this.seenEventIds) {
        if (i++ >= drop) break;
        this.seenEventIds.delete(id);
      }
    }
    try {
      this.args.onEvent(event);
    } catch {
      // Consumer-side errors must not poison the WS loop.
    }
  }
}
