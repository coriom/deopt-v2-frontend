/**
 * Lifecycle private-WS mock fixture for Playwright.
 *
 * Installs a `page.routeWebSocket` handler matching `/ws` that
 * emulates the backend JSON-RPC subscription protocol just enough to
 * drive the production `LifecycleWsClient` through:
 *
 *   1. `auth.challenge` → returns `{nonce, message, expires_at_ms, chain_id}`
 *   2. `auth.verify`    → recovers the EIP-191 signer and verifies it
 *                         matches the requesting address, then returns
 *                         `{authenticated: true}` (or `{error}` on mismatch)
 *   3. `subscribe`      → returns `{subscription_id}` for each of the
 *                         three lifecycle channels
 *
 * The fixture returns a controller the test can use to push lifecycle
 * deltas, close the underlying connection (to exercise reconnect /
 * resync), and inspect what the client sent during auth.
 *
 * No production code is bypassed. The real `LifecycleWsClient`,
 * `useLifecycleStream`, `parseLifecycleFrame`, and wallet `signMessage`
 * all run unmodified — only the *backend WS endpoint* is replaced.
 */

import type { Page, WebSocketRoute } from "@playwright/test";
import { recoverMessageAddress } from "viem";

export type LifecycleChannel =
  | "account.orders"
  | "account.fills"
  | "account.conditional_orders";

const LIFECYCLE_CHANNELS: LifecycleChannel[] = [
  "account.orders",
  "account.fills",
  "account.conditional_orders",
];

export interface PushDeltaArgs {
  channel: LifecycleChannel;
  payload: unknown;
  /** Defaults to a unique per-call id; pass the same id twice to
   *  exercise the client's dedupe path. */
  eventId?: string;
  /** Per-channel monotonic seq the client preserves; default auto-inc. */
  seq?: number;
  /** Defaults to the connected client's authenticated address; pass
   *  a different one to exercise the hook's privacy belt-and-brace. */
  address?: string;
  /** Backend tag — defaults to `backend`. */
  source?: string;
}

export interface LifecycleWsMock {
  /** Push a JSON-RPC `subscription` frame to the connected client. */
  pushDelta: (args: PushDeltaArgs) => Promise<void>;
  /** Close the active socket (simulates server-side drop). */
  closeConnection: () => Promise<void>;
  /** Resolve when the client has completed subscribe for ALL channels. */
  waitForSubscribed: (timeoutMs?: number) => Promise<void>;
  /** Captured signature from `auth.verify` (null if not yet received). */
  capturedSignature: () => string | null;
  /** Address the client authenticated with (lowercase). */
  authenticatedAddress: () => string | null;
  /** Whether the signature was recoverable to `authenticatedAddress`. */
  signatureRecovered: () => boolean | null;
  /** Count of currently-active sockets the mock is tracking. */
  activeSockets: () => number;
}

interface MockState {
  route: WebSocketRoute | null;
  subscribedChannels: Set<string>;
  capturedSignature: string | null;
  authenticatedAddress: string | null;
  signatureRecovered: boolean | null;
  seqByChannel: Map<string, number>;
  eventCounter: number;
  activeSockets: number;
  subscribedResolvers: Array<() => void>;
}

function newState(): MockState {
  return {
    route: null,
    subscribedChannels: new Set(),
    capturedSignature: null,
    authenticatedAddress: null,
    signatureRecovered: null,
    seqByChannel: new Map(),
    eventCounter: 0,
    activeSockets: 0,
    subscribedResolvers: [],
  };
}

function jsonOk(id: unknown, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function jsonErr(id: unknown, code: string, message: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

export async function installLifecycleWsMock(page: Page): Promise<LifecycleWsMock> {
  const state = newState();

  await page.routeWebSocket(/\/ws(?:\?|$)/, (ws) => {
    state.activeSockets += 1;
    state.route = ws;
    state.subscribedChannels = new Set();

    ws.onMessage(async (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      let frame: {
        id?: unknown;
        method?: unknown;
        params?: Record<string, unknown>;
      };
      try {
        frame = JSON.parse(text);
      } catch {
        return;
      }
      const id = frame.id;
      const method = frame.method;
      const params = (frame.params ?? {}) as Record<string, unknown>;

      if (method === "auth.challenge") {
        const address =
          typeof params.address === "string"
            ? params.address.toLowerCase()
            : null;
        if (!address) {
          ws.send(jsonErr(id, "INVALID_PARAMS", "auth.challenge missing address"));
          return;
        }
        state.authenticatedAddress = address;
        ws.send(
          jsonOk(id, {
            nonce: `nonce_${Math.random().toString(36).slice(2, 10)}`,
            // Match the backend's challenge message shape: a short
            // human-readable string the wallet shows in the prompt.
            message: `DeOpt lifecycle WS auth (test): ${address}`,
            expires_at_ms: Date.now() + 60_000,
            chain_id: 31337,
          }),
        );
        return;
      }

      if (method === "auth.verify") {
        const sig = params.signature;
        const address =
          typeof params.address === "string"
            ? params.address.toLowerCase()
            : state.authenticatedAddress;
        state.capturedSignature = typeof sig === "string" ? sig : null;
        try {
          if (
            typeof sig === "string" &&
            typeof address === "string" &&
            /^0x[0-9a-fA-F]{130}$/.test(sig)
          ) {
            const recovered = await recoverMessageAddress({
              message: `DeOpt lifecycle WS auth (test): ${address}`,
              signature: sig as `0x${string}`,
            });
            state.signatureRecovered =
              recovered.toLowerCase() === address.toLowerCase();
          } else {
            state.signatureRecovered = false;
          }
        } catch {
          state.signatureRecovered = false;
        }
        if (!state.signatureRecovered) {
          ws.send(
            jsonErr(id, "AUTH_REJECTED", "signature does not recover to address"),
          );
          return;
        }
        ws.send(
          jsonOk(id, {
            authenticated: true,
            address: state.authenticatedAddress,
          }),
        );
        return;
      }

      if (method === "subscribe") {
        const channel =
          typeof params.channel === "string" ? params.channel : null;
        if (!channel) {
          ws.send(jsonErr(id, "INVALID_PARAMS", "subscribe missing channel"));
          return;
        }
        state.subscribedChannels.add(channel);
        ws.send(
          jsonOk(id, {
            subscription_id: `sub_${channel}_${Math.random().toString(36).slice(2, 10)}`,
            channel,
          }),
        );
        if (
          LIFECYCLE_CHANNELS.every((c) => state.subscribedChannels.has(c)) &&
          state.subscribedResolvers.length > 0
        ) {
          const resolvers = state.subscribedResolvers.splice(0);
          for (const r of resolvers) r();
        }
        return;
      }

      // Any other method: respond with empty result so we don't
      // accidentally trip the client's 10s request timeout.
      if (typeof id !== "undefined") {
        ws.send(jsonOk(id, {}));
      }
    });

    ws.onClose(() => {
      state.activeSockets = Math.max(0, state.activeSockets - 1);
      if (state.route === ws) {
        state.route = null;
        state.subscribedChannels = new Set();
      }
    });
  });

  return {
    pushDelta: async (args) => {
      const route = state.route;
      if (!route) {
        throw new Error(
          "lifecycle-ws-fixture: cannot pushDelta — no active socket",
        );
      }
      const channel = args.channel;
      const prevSeq = state.seqByChannel.get(channel) ?? 0;
      const seq = args.seq ?? prevSeq + 1;
      state.seqByChannel.set(channel, seq);
      state.eventCounter += 1;
      const eventId = args.eventId ?? `evt_test_${state.eventCounter}`;
      const address =
        args.address ?? state.authenticatedAddress ?? "0xaccount";
      const frame = JSON.stringify({
        jsonrpc: "2.0",
        method: "subscription",
        params: {
          subscription_id: `sub_${channel}`,
          channel,
          seq,
          event_id: eventId,
          source: args.source ?? "backend",
          chain_id: 84532,
          generated_at_ms: Date.now(),
          address,
          data: {
            type: "lifecycle_delta",
            emitted_at_ms: Date.now(),
            payload: args.payload,
          },
        },
      });
      route.send(frame);
    },
    closeConnection: async () => {
      if (state.route) {
        await state.route.close({ code: 1006, reason: "test_drop" });
      }
    },
    waitForSubscribed: (timeoutMs = 10_000) => {
      if (LIFECYCLE_CHANNELS.every((c) => state.subscribedChannels.has(c))) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(
            new Error(
              `lifecycle-ws-fixture: timed out waiting for subscribe; got [${[...state.subscribedChannels].join(", ")}]`,
            ),
          );
        }, timeoutMs);
        state.subscribedResolvers.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    },
    capturedSignature: () => state.capturedSignature,
    authenticatedAddress: () => state.authenticatedAddress,
    signatureRecovered: () => state.signatureRecovered,
    activeSockets: () => state.activeSockets,
  };
}
