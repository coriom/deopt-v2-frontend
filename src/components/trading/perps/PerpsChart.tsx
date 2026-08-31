"use client";

// TradingView Advanced Chart widget embed for the perps chart widget.
//
// Loads TradingView's `tv.js` script once and instantiates the
// standard TradingView chart (dark theme, left-side drawing toolbar,
// top timeframe controls, right price scale). Data comes from
// TradingView's own aggregation (Binance / Coinbase / …) — perps
// aren't live for trading yet, so this surface is a market-context
// chart, NOT a mark/index feed sourced from our backend. The
// perps-trade widget stays fail-closed independently.

import { useEffect, useId, useRef } from "react";
import { usePerpsSymbol } from "@/lib/perps-symbol";
import { PerpsStatsWidget } from "./PerpsStats";

const TV_SCRIPT_ID = "deopt-tradingview-tv-js";
const TV_SCRIPT_SRC = "https://s3.tradingview.com/tv.js";

interface TradingViewWidgetInstance {
  remove(): void;
}
interface TradingViewApi {
  widget: new (options: Record<string, unknown>) => TradingViewWidgetInstance;
}
declare global {
  interface Window {
    TradingView?: TradingViewApi;
  }
}

/** Map our internal perp symbols to the TradingView symbols that
 *  its chart understands. BINANCE spot USDT pairs are used because
 *  they're the most liquid public reference for BTC/ETH markets. */
const SYMBOL_MAP: Record<string, string> = {
  "BTC-PERP": "BINANCE:BTCUSDT",
  "ETH-PERP": "BINANCE:ETHUSDT",
};

function tradingViewSymbol(perpSymbol: string): string {
  return SYMBOL_MAP[perpSymbol] ?? "BINANCE:BTCUSDT";
}

/** Load `tv.js` at most once per page. Returns a promise that resolves
 *  as soon as `window.TradingView` is available. */
function loadTradingViewScript(): Promise<TradingViewApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SSR"));
  }
  if (window.TradingView) return Promise.resolve(window.TradingView);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(TV_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.TradingView) resolve(window.TradingView);
        else reject(new Error("TradingView global missing after load"));
      });
      existing.addEventListener("error", () => reject(new Error("tv.js load error")));
      return;
    }
    const script = document.createElement("script");
    script.id = TV_SCRIPT_ID;
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.TradingView) resolve(window.TradingView);
      else reject(new Error("TradingView global missing after load"));
    };
    script.onerror = () => reject(new Error("tv.js load error"));
    document.body.appendChild(script);
  });
}

export function PerpsChartWidget() {
  const { market } = usePerpsSymbol();
  // Stable unique id per widget instance so multiple charts on the
  // same page never collide on `container_id`.
  const rawId = useId();
  const containerId = `tv-chart-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<TradingViewWidgetInstance | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTradingViewScript()
      .then((tv) => {
        if (cancelled || !containerRef.current) return;
        // Tear down the previous instance before spawning a new one
        // (symbol change / remount).
        widgetRef.current?.remove();
        containerRef.current.innerHTML = "";
        widgetRef.current = new tv.widget({
          container_id: containerId,
          symbol: tradingViewSymbol(market.symbol),
          interval: "60",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#09090b",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_side_toolbar: false,
          withdateranges: true,
          save_image: false,
          autosize: true,
        });
      })
      .catch(() => {
        // Silent — script may be blocked by the network or an ad
        // blocker; the container simply stays empty. The stats
        // bandeau above is unaffected.
      });
    return () => {
      cancelled = true;
      widgetRef.current?.remove();
      widgetRef.current = null;
    };
  }, [market.symbol, containerId]);

  return (
    <div
      data-testid="widget-perps-chart-body"
      className="flex h-full min-h-0 flex-col"
    >
      {/* Merged stats bandeau sits above the chart, unchanged. */}
      <div
        data-testid="widget-perps-chart-stats"
        className="shrink-0 border-b border-zinc-900"
      >
        <PerpsStatsWidget />
      </div>
      <div
        id={containerId}
        ref={containerRef}
        data-testid="widget-perps-chart-canvas"
        className="min-h-0 flex-1"
      />
    </div>
  );
}
