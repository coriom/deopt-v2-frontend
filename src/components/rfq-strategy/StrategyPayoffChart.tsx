"use client";

import { useMemo } from "react";
import type { StrategyState } from "@/lib/rfq-strategy-model";
import {
  defaultSpotRange,
  payoffMetrics,
  samplePayoffCurve,
} from "@/lib/rfq-strategy-payoff";

export function StrategyPayoffChart({ state }: { state: StrategyState }) {
  const { samples, metrics, range } = useMemo(() => {
    const range = defaultSpotRange(state);
    const samples = samplePayoffCurve(state, range.sMin, range.sMax, 96);
    const metrics = payoffMetrics(state, samples);
    return { samples, metrics, range };
  }, [state]);

  if (state.legs.length === 0) {
    return (
      <div
        data-testid="rfq-strategy-payoff-empty"
        className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500"
      >
        Add or select a preset with at least one leg to render the payoff
        curve.
      </div>
    );
  }

  const W = 320;
  const H = 140;
  const PAD_X = 8;
  const PAD_Y = 12;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;

  const pnlMin = Math.min(...samples.map((s) => s.pnl));
  const pnlMax = Math.max(...samples.map((s) => s.pnl));
  const pnlSpan = Math.max(pnlMax - pnlMin, 1);
  const sMin = range.sMin;
  const sSpan = Math.max(range.sMax - sMin, 1);

  const xFor = (s: number) => PAD_X + ((s - sMin) / sSpan) * plotW;
  const yFor = (pnl: number) =>
    PAD_Y + (1 - (pnl - pnlMin) / pnlSpan) * plotH;

  const yZero = pnlMin < 0 && pnlMax > 0 ? yFor(0) : null;

  const path = samples
    .map((s, i) => `${i === 0 ? "M" : "L"} ${xFor(s.s).toFixed(2)} ${yFor(s.pnl).toFixed(2)}`)
    .join(" ");

  return (
    <div
      data-testid="rfq-strategy-payoff-chart"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/40 p-3"
    >
      <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.14em]">
        <MetricCell
          label="Max loss"
          value={fmtCurrency(metrics.maxLoss)}
          testid="rfq-strategy-metric-max-loss"
          tint="loss"
        />
        <MetricCell
          label="Break-even"
          value={
            metrics.breakEvens.length
              ? metrics.breakEvens
                  .map((b) => `$${Math.round(b).toLocaleString("en-US")}`)
                  .join(" / ")
              : "—"
          }
          testid="rfq-strategy-metric-break-even"
        />
        <MetricCell
          label="Max profit"
          value={fmtCurrency(metrics.maxProfit)}
          testid="rfq-strategy-metric-max-profit"
          tint="profit"
        />
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Payoff curve at expiry"
        className="h-40 w-full"
      >
        {yZero !== null && (
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={yZero}
            y2={yZero}
            stroke="#3f3f46"
            strokeWidth="0.5"
            strokeDasharray="2,3"
          />
        )}
        {samples.length > 0 && (
          <path
            d={path}
            stroke="#10b981"
            strokeWidth="1.5"
            fill="none"
            data-testid="rfq-strategy-payoff-curve"
          />
        )}
        <text x={PAD_X} y={H - 2} fontSize="7" fill="#a1a1aa">
          ${Math.round(sMin).toLocaleString("en-US")}
        </text>
        <text x={W - PAD_X} y={H - 2} fontSize="7" fill="#a1a1aa" textAnchor="end">
          ${Math.round(range.sMax).toLocaleString("en-US")}
        </text>
      </svg>
      {metrics.premiumExcluded && (
        <p
          data-testid="rfq-strategy-payoff-premium-excluded"
          className="text-[10px] text-zinc-500"
        >
          Payoff excludes live RFQ premium. Set a per-leg premium manually to
          preview net PnL, or wait until RFQ quotes are live.
        </p>
      )}
    </div>
  );
}

function fmtCurrency(v: number): string {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "−∞";
  const sign = v < 0 ? "−" : "";
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
}

function MetricCell({
  label,
  value,
  testid,
  tint,
}: {
  label: string;
  value: string;
  testid: string;
  tint?: "loss" | "profit";
}) {
  const tintClass =
    tint === "loss"
      ? "text-red-300"
      : tint === "profit"
        ? "text-emerald-300"
        : "text-zinc-200";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-zinc-500">{label}</span>
      <span
        data-testid={testid}
        className={`font-mono text-[13px] normal-case tracking-normal ${tintClass}`}
      >
        {value}
      </span>
    </div>
  );
}
