"use client";

// FRONTEND-PERPS-POLISH-V1 — perps trade form widget.
//
// Visually interactive (tabs, inputs, slider) so the operator can
// preview the UX, but the submit button is permanently disabled with
// a `Perps not live` guard until the perps executor ships. No wallet
// signing, no broadcast, no chain RPC, no real prices — the preview
// rows render `—`.

import { useState } from "react";
import { usePerpsSymbol } from "@/lib/perps-symbol";

type Side = "long" | "short";
type Mode = "market" | "limit";

export function PerpsTradeFormWidget() {
  const { market } = usePerpsSymbol();
  const [side, setSide] = useState<Side>("long");
  const [mode, setMode] = useState<Mode>("market");
  const [qty, setQty] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [leverage, setLeverage] = useState<number>(1);
  const [slippagePct, setSlippagePct] = useState<string>("0.5");

  return (
    <div
      data-testid="widget-perps-trade-form-body"
      className="flex h-full min-h-0 flex-col gap-2 px-3 py-2"
    >
      <span
        className="text-[11px] font-mono text-zinc-400"
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        {market.symbol}
      </span>

      {/* Long / Short */}
      <div
        role="tablist"
        aria-label="Side"
        data-testid="widget-perps-trade-side"
        className="grid grid-cols-2 gap-1"
      >
        <SideTab
          active={side === "long"}
          tone="long"
          onClick={() => setSide("long")}
          testid="widget-perps-trade-side-long"
        >
          Long
        </SideTab>
        <SideTab
          active={side === "short"}
          tone="short"
          onClick={() => setSide("short")}
          testid="widget-perps-trade-side-short"
        >
          Short
        </SideTab>
      </div>

      {/* Market / Limit */}
      <div
        role="tablist"
        aria-label="Order mode"
        data-testid="widget-perps-trade-mode"
        className="flex gap-1 text-[11px]"
      >
        {(["market", "limit"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            data-testid={`widget-perps-trade-mode-${m}`}
            className={
              mode === m
                ? "rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200"
                : "rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
            }
          >
            {m === "market" ? "Market" : "Limit"}
          </button>
        ))}
      </div>

      {/* Size */}
      <Field label="Size (USD)">
        <input
          type="text"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="0.00"
          data-testid="widget-perps-trade-qty"
          className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-[12px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          style={{ fontFamily: "var(--app-font-mono)" }}
        />
      </Field>

      {/* Limit price (only in limit mode) */}
      {mode === "limit" ? (
        <Field label="Limit price">
          <input
            type="text"
            inputMode="decimal"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.00"
            data-testid="widget-perps-trade-limit-price"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-[12px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            style={{ fontFamily: "var(--app-font-mono)" }}
          />
        </Field>
      ) : (
        <Field label="Slippage tolerance">
          <input
            type="text"
            inputMode="decimal"
            value={slippagePct}
            onChange={(e) => setSlippagePct(e.target.value)}
            placeholder="0.5"
            data-testid="widget-perps-trade-slippage"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-[12px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            style={{ fontFamily: "var(--app-font-mono)" }}
          />
        </Field>
      )}

      {/* Leverage slider */}
      <Field label={`Leverage ${leverage}×`}>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          data-testid="widget-perps-trade-leverage"
          className="w-full accent-emerald-500"
        />
      </Field>

      {/* Summary */}
      <div
        data-testid="widget-perps-trade-summary"
        className="grid grid-cols-3 gap-px overflow-hidden rounded border border-zinc-800 bg-zinc-900 text-[11px]"
      >
        {[
          { label: "Liq", testid: "summary-liq" },
          { label: "Funding", testid: "summary-funding" },
          { label: "Fee", testid: "summary-fee" },
        ].map((s) => (
          <div
            key={s.testid}
            data-testid={`widget-perps-trade-${s.testid}`}
            className="flex flex-col gap-0.5 bg-zinc-950 px-2 py-1"
          >
            <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              {s.label}
            </span>
            <span
              className="font-mono text-[11px] text-zinc-300"
              style={{ fontFamily: "var(--app-font-mono)" }}
            >
              —
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        data-testid="widget-perps-trade-submit"
        title="Perps execution ships in a later milestone."
        className="cursor-not-allowed rounded border border-zinc-700 bg-zinc-900/60 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
      >
        Perps not live
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function SideTab({
  active,
  tone,
  onClick,
  testid,
  children,
}: {
  active: boolean;
  tone: "long" | "short";
  onClick: () => void;
  testid: string;
  children: React.ReactNode;
}) {
  // Subtle tonal hint without using amber/yellow/orange: long stays
  // emerald-family (DeOpt accent), short uses a desaturated red.
  const activeCls =
    tone === "long"
      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
      : "border-red-500/50 bg-red-950/40 text-red-200";
  const idleCls = "border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testid}
      className={`rounded border py-1.5 text-[12px] font-semibold ${
        active ? activeCls : idleCls
      }`}
    >
      {children}
    </button>
  );
}
