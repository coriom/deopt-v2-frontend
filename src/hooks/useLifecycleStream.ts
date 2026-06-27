// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — single shared lifecycle WS
// hook. Each consumer panel subscribes to the channel slice it cares
// about; the hook owns one underlying `LifecycleWsClient` per mounted
// `<WalletProvider>`-scoped subtree.
//
// Privacy guarantee: the hook never returns a delta whose
// `event.address` differs from the authenticated wallet address —
// the backend already filters per-session, but we belt-and-brace
// here too.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LifecycleWsClient,
  type SignMessageFn,
} from "@/lib/lifecycle-ws";
import type {
  LifecycleChannel,
  LifecycleConnectionStatus,
  LifecycleEvent,
} from "@/lib/lifecycle-types";
import { useWallet } from "@/lib/wallet";

type Handler = (event: LifecycleEvent) => void;

interface LifecycleStream {
  /** Latest connection state. */
  status: LifecycleConnectionStatus;
  /** Last status detail (e.g. reconnect reason). Safe to render. */
  statusDetail: string | null;
  /** Increments after each successful (re)subscribe — drive REST refetch off this. */
  resyncToken: number;
  /** Subscribe a handler for one channel; returns an unsubscribe function. */
  subscribe(channel: LifecycleChannel, handler: Handler): () => void;
}

export function useLifecycleStream(): LifecycleStream {
  const { address, isExpectedChain, signMessage } = useWallet();
  const [status, setStatus] = useState<LifecycleConnectionStatus>("disconnected");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [resyncToken, setResyncToken] = useState(0);

  // One registry of handlers per channel. Stable across renders.
  const handlersRef = useRef<Map<LifecycleChannel, Set<Handler>>>(new Map());
  const clientRef = useRef<LifecycleWsClient | null>(null);

  // A stable signMessage closure for the client (it stores it for the
  // session lifetime; React identity stability matters here).
  const signMessageStable = useRef<SignMessageFn>(signMessage);
  useEffect(() => {
    signMessageStable.current = signMessage;
  }, [signMessage]);

  const dispatchEvent = useCallback((event: LifecycleEvent) => {
    // Privacy belt-and-brace: drop any event whose address doesn't
    // match the current wallet (should never fire with a correctly
    // authenticated session, but the cost of the check is one string
    // compare).
    if (address && !event.address.toLowerCase().includes(address.toLowerCase().slice(2))) {
      return;
    }
    const set = handlersRef.current.get(event.channel);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(event);
      } catch {
        // One handler's error must not poison the others.
      }
    }
  }, [address]);

  // (Re-)create the client when (address, expected-chain) changes.
  useEffect(() => {
    // Tear down any prior client.
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    if (!address || !isExpectedChain) {
      // We're explicitly tearing down the external WS client here in
      // response to the wallet/chain dependency change — that's exactly
      // the "synchronise to external system" effect pattern. The state
      // updates surface the new connection state to the consumer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("disconnected");
      setStatusDetail(address ? "wrong network" : "wallet disconnected");
      return;
    }
    const client = new LifecycleWsClient({
      address: address.toLowerCase(),
      signMessage: (m) => signMessageStable.current(m),
      onEvent: dispatchEvent,
      onStatus: (s, detail) => {
        setStatus(s);
        setStatusDetail(detail ?? null);
      },
      onResync: () => {
        setResyncToken((n) => n + 1);
      },
    });
    clientRef.current = client;
    client.start();
    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [address, isExpectedChain, dispatchEvent]);

  const subscribe = useCallback(
    (channel: LifecycleChannel, handler: Handler): (() => void) => {
      let set = handlersRef.current.get(channel);
      if (!set) {
        set = new Set();
        handlersRef.current.set(channel, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
      };
    },
    [],
  );

  return useMemo(
    () => ({ status, statusDetail, resyncToken, subscribe }),
    [status, statusDetail, resyncToken, subscribe],
  );
}
