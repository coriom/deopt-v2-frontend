"use client";

// TradingView is an external market-context chart, not a DeOpt price
// oracle. Keep its JavaScript inside its own document so widget teardown
// cannot mutate a React-managed container after route changes.

import { useId } from "react";
import { usePerpsSymbol } from "@/lib/perps-symbol";
import { PerpsStatsWidget } from "./PerpsStats";

const SYMBOL_MAP: Record<string, string> = {
  "BTC-PERP": "BINANCE:BTCUSDT",
  "ETH-PERP": "BINANCE:ETHUSDT",
};

function chartUrl(perpSymbol: string, frameId: string): string {
  const symbol = SYMBOL_MAP[perpSymbol] ?? SYMBOL_MAP["BTC-PERP"];
  const query = new URLSearchParams({
    hideideas: "1",
    overrides: "{}",
    enabled_features: "[]",
    disabled_features: "[]",
    locale: "en",
  });
  const settings = {
    symbol,
    frameElementId: frameId,
    interval: "60",
    hide_side_toolbar: "0",
    allow_symbol_change: "0",
    save_image: "0",
    studies: "[]",
    theme: "dark",
    style: "1",
    timezone: "Etc/UTC",
    withdateranges: "1",
    studies_overrides: "{}",
  };
  return `https://s.tradingview.com/widgetembed/?${query}#${encodeURIComponent(JSON.stringify(settings))}`;
}

export function PerpsChartWidget() {
  const { market } = usePerpsSymbol();
  const frameId = `tv-chart-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div data-testid="widget-perps-chart-body" className="flex h-full min-h-0 flex-col">
      <div data-testid="widget-perps-chart-stats" className="shrink-0 border-b border-zinc-900">
        <PerpsStatsWidget />
      </div>
      <div data-testid="widget-perps-chart-canvas" className="min-h-0 flex-1">
        <iframe
          id={frameId}
          title={`${market.symbol} TradingView reference chart`}
          src={chartUrl(market.symbol, frameId)}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
