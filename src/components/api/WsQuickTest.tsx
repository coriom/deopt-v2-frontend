"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Status = "idle" | "connecting" | "open" | "closing" | "closed" | "error";

interface LogLine {
  id: number;
  direction: "in" | "out" | "info";
  text: string;
}

const PUBLIC_CHANNELS = [
  "trading.health",
  "options.products",
  "leaderboard",
] as const;

const STATUS_STYLE: Record<Status, string> = {
  idle: "border-zinc-800 bg-zinc-950 text-zinc-400",
  connecting: "border-emerald-500/40 bg-emerald-500/5 text-emerald-200",
  open: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
  closing: "border-zinc-700 bg-zinc-900 text-zinc-300",
  closed: "border-zinc-800 bg-zinc-950 text-zinc-500",
  error: "border-red-500/60 bg-red-950/40 text-red-200",
};

function computeDefaultWsUrl(): string {
  if (typeof process !== "undefined") {
    const explicit = process.env.NEXT_PUBLIC_PUBLIC_WS_URL;
    if (explicit && explicit.length > 0) return explicit;
    const httpBase = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL;
    if (httpBase && httpBase.length > 0) {
      try {
        const u = new URL(httpBase);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        const trimmed = `${u.protocol}//${u.host}`.replace(/\/$/, "");
        return `${trimmed}/ws`;
      } catch {
        /* fall through */
      }
    }
  }
  return "ws://localhost:8080/ws";
}

export function WsQuickTest() {
  const defaultUrl = useMemo(() => computeDefaultWsUrl(), []);
  const [url, setUrl] = useState<string>(defaultUrl);
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<LogLine[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reqIdRef = useRef<number>(1);
  const logSeqRef = useRef<number>(0);

  const append = useCallback((direction: LogLine["direction"], text: string) => {
    logSeqRef.current += 1;
    const id = logSeqRef.current;
    setLog((prev) => {
      const next = [...prev, { id, direction, text }];
      // Cap log to 200 lines to keep DOM cheap.
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const connect = useCallback(() => {
    if (wsRef.current && status !== "closed" && status !== "error") return;
    if (!url) return;
    setStatus("connecting");
    append("info", `connecting → ${url}`);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      append("info", `connect failed: ${msg}`);
      setStatus("error");
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus("open");
      append("info", "connection open");
    };
    ws.onclose = (ev) => {
      setStatus("closed");
      append("info", `connection closed (code ${ev.code})`);
      wsRef.current = null;
    };
    ws.onerror = () => {
      setStatus("error");
      append("info", "connection error");
    };
    ws.onmessage = (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "<binary frame>";
      let text = raw;
      try {
        text = JSON.stringify(JSON.parse(raw));
      } catch {
        /* keep raw */
      }
      append("in", text);
    };
  }, [append, status, url]);

  const disconnect = useCallback(() => {
    if (!wsRef.current) return;
    setStatus("closing");
    append("info", "disconnect requested");
    try {
      wsRef.current.close();
    } catch {
      /* ignore */
    }
  }, [append]);

  const sendJson = useCallback(
    (payload: unknown) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        append("info", "not connected — send ignored");
        return;
      }
      const json = JSON.stringify(payload);
      try {
        ws.send(json);
        append("out", json);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        append("info", `send failed: ${msg}`);
      }
    },
    [append],
  );

  const nextId = useCallback((prefix: string) => {
    const n = reqIdRef.current;
    reqIdRef.current += 1;
    return `${prefix}_${n}`;
  }, []);

  const sendPing = useCallback(() => {
    sendJson({ jsonrpc: "2.0", id: nextId("ping"), method: "ping" });
  }, [nextId, sendJson]);

  const subscribe = useCallback(
    (channel: string) => {
      sendJson({
        jsonrpc: "2.0",
        id: nextId("sub"),
        method: "subscribe",
        params: { channel },
      });
    },
    [nextId, sendJson],
  );

  const clearLog = useCallback(() => setLog([]), []);

  const statusLabel = useMemo(() => {
    if (status === "open") return "open";
    if (status === "connecting") return "connecting";
    if (status === "closing") return "closing";
    if (status === "error") return "error";
    if (status === "closed") return "closed";
    return "idle";
  }, [status]);

  const canConnect = status !== "open" && status !== "connecting";
  const canSend = status === "open";

  return (
    <section
      data-testid="api-ws-quick-test"
      className="rounded-md border border-zinc-900 bg-black"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 bg-zinc-950 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          WebSocket Quick Test
        </span>
        <span
          data-testid="api-ws-quick-test-status"
          className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${STATUS_STYLE[status]}`}
        >
          {statusLabel}
        </span>
      </header>
      <div className="flex flex-col gap-2 px-3 py-2">
        <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
          <span className="uppercase tracking-[0.16em] text-zinc-500">
            WebSocket URL
          </span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={defaultUrl || "ws://localhost:8080/ws"}
            spellCheck={false}
            data-testid="api-ws-quick-test-url"
            className="rounded border border-zinc-800 bg-black/60 px-2 py-1 font-mono text-[12px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            style={{ fontFamily: "var(--app-font-mono)" }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={connect}
            disabled={!canConnect}
            data-testid="api-ws-quick-test-connect"
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Connect
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={status !== "open"}
            data-testid="api-ws-quick-test-disconnect"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] text-zinc-200 hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Disconnect
          </button>
          <span className="mx-1 h-4 w-px bg-zinc-800" aria-hidden="true" />
          <button
            type="button"
            onClick={sendPing}
            disabled={!canSend}
            data-testid="api-ws-quick-test-ping"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] text-zinc-200 hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ping
          </button>
          {PUBLIC_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => subscribe(c)}
              disabled={!canSend}
              data-testid={`api-ws-quick-test-sub-${c}`}
              className="rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-200 hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ fontFamily: "var(--app-font-mono)" }}
            >
              {`sub ${c}`}
            </button>
          ))}
          <span className="ml-auto" />
          <button
            type="button"
            onClick={clearLog}
            data-testid="api-ws-quick-test-clear"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] text-zinc-400 hover:border-emerald-500/40 hover:text-zinc-200"
          >
            Clear
          </button>
        </div>
        <div
          data-testid="api-ws-quick-test-log"
          className="h-56 overflow-auto rounded border border-zinc-900 bg-zinc-950 p-2 font-mono text-[11px] leading-relaxed text-zinc-300"
          style={{ fontFamily: "var(--app-font-mono)" }}
        >
          {log.length === 0 ? (
            <span className="text-zinc-600">
              Log is empty. Connect, then ping or subscribe to a public channel.
            </span>
          ) : (
            log.map((l) => (
              <div key={l.id} className="whitespace-pre-wrap break-all">
                <span
                  className={
                    l.direction === "in"
                      ? "text-emerald-300"
                      : l.direction === "out"
                        ? "text-zinc-300"
                        : "text-zinc-500"
                  }
                >
                  {l.direction === "in"
                    ? "← "
                    : l.direction === "out"
                      ? "→ "
                      : "· "}
                </span>
                <span>{l.text}</span>
              </div>
            ))
          )}
        </div>
        <p className="text-[10px] text-zinc-500">
          Runs entirely in your browser. No wallet signing, no external API
          calls. If the backend is offline the panel reports the failure and
          stays usable.
        </p>
      </div>
    </section>
  );
}
