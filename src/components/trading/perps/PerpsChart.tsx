"use client";

// FRONTEND-PERPS-POLISH-V1 — perps chart widget.
//
// Renders TradingView Lightweight Charts (Apache 2.0, self-hosted —
// no external network call, no Binance/CoinGecko price feed). Until
// the backend exposes a mark/index price source, the chart shows an
// honest empty state on top of the chart canvas (axes + grid still
// render, so the visual is professional but never fakes candles).

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import { usePerpsSymbol } from "@/lib/perps-symbol";
import { PerpsStatsWidget } from "./PerpsStats";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

interface ChartHandles {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
}

export function PerpsChartWidget() {
  const { market } = usePerpsSymbol();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<ChartHandles | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#09090b" }, // zinc-950
        textColor: "#a1a1aa", // zinc-400
        fontFamily: "var(--app-font-mono)",
      },
      grid: {
        vertLines: { color: "#18181b" }, // zinc-900
        horzLines: { color: "#18181b" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#27272a", style: 2, width: 1 },
        horzLine: { color: "#27272a", style: 2, width: 1 },
      },
      rightPriceScale: { borderColor: "#27272a" },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
      handleScale: true,
      handleScroll: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",       // emerald-500
      downColor: "#ef4444",     // red-500
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    // Empty data — chart renders axes/grid without any fabricated candles.
    series.setData([] as CandlestickData<Time>[]);
    handlesRef.current = { chart, series };
    return () => {
      chart.remove();
      handlesRef.current = null;
    };
  }, []);

  // When market changes, reset the (currently empty) series.
  useEffect(() => {
    const h = handlesRef.current;
    if (!h) return;
    h.series.setData([] as CandlestickData<Time>[]);
  }, [market.symbol]);

  return (
    <div
      data-testid="widget-perps-chart-body"
      className="flex h-full min-h-0 flex-col"
    >
      {/* Merged stats bandeau (Derive-style) — sits at the top of the
          chart widget so the workspace doesn't need a separate
          perps-stats tile under the navbar. */}
      <div
        data-testid="widget-perps-chart-stats"
        className="shrink-0 border-b border-zinc-900"
      >
        <PerpsStatsWidget />
      </div>
      {/* OHLC ticker + timeframe row. The OHLC values render `—`
          until the backend exposes a real mark / index feed. */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 px-2 py-1">
        <span
          data-testid="widget-perps-chart-ohlc"
          className="font-mono text-[10px] text-zinc-500"
          style={{ fontFamily: "var(--app-font-mono)" }}
        >
          O — H — L — C —
        </span>
        <div
          role="tablist"
          aria-label="Timeframe"
          data-testid="widget-perps-chart-timeframes"
          className="flex items-center gap-0.5"
        >
          {TIMEFRAMES.map((t) => {
            const active = t === timeframe;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTimeframe(t)}
                data-testid={`widget-perps-chart-tf-${t}`}
                className={
                  active
                    ? "rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-200"
                    : "rounded border border-transparent px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400 hover:text-emerald-200"
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      </header>
      <div className="relative flex-1 min-h-0">
        <div
          ref={containerRef}
          data-testid="widget-perps-chart-canvas"
          className="absolute inset-0"
        />
        <div
          data-testid="widget-perps-chart-empty"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center"
        >
          <span className="rounded border border-zinc-800 bg-black/70 px-2 py-1 text-[11px] text-zinc-300">
            No live price feed yet
          </span>
          <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-zinc-500">
            Chart activates when the perps mark / index feed ships.
          </span>
        </div>
      </div>
    </div>
  );
}
