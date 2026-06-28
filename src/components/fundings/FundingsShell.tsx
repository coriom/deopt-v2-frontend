"use client";

// FRONTEND-FUNDINGS-PAGE-V1 — minimal honest DeOpt funding overview.
//
// The page intentionally surfaces only DeOpt's own funding (no
// multi-venue comparison). Backend has no funding-rate endpoint
// today, so every numeric cell renders `—` and every row carries a
// single muted `Planned` pill. Symbols mirror the perp markets
// seeded by `~/DEOPT/deopt-v2-backend/src/engine/state.rs::default_markets()`
// — exactly BTC-PERP + ETH-PERP — so the page never speculates
// about coverage that doesn't exist.
//
// When the backend ships a per-market funding endpoint, swap the
// static rows for a live fetch; the layout stays.

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { docsPath } from "@/lib/docs-url";

interface MarketRow {
  symbol: string; // mirrors backend default_markets() seed
}

const MARKETS: MarketRow[] = [
  { symbol: "BTC-PERP" },
  { symbol: "ETH-PERP" },
];

const PERIODS = ["1H", "8H", "1D", "30D", "1Y"] as const;
type Period = (typeof PERIODS)[number];
const DEFAULT_PERIOD: Period = "1Y";

export function FundingsShell() {
  const { address } = useWallet();
  const connected = !!address;
  return (
    <div
      data-testid="fundings-page"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-zinc-200"
    >
      <Header />
      <OverviewTable />
      <AccountFundingPanel connected={connected} />
      <MethodologyNote />
    </div>
  );
}

function Header() {
  return (
    <header
      data-testid="fundings-page-header"
      className="flex flex-col gap-3 border-b border-zinc-900 pb-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Funding
          </h1>
          <p className="text-[13px] text-zinc-400">
            Funding applies to perpetual markets. Options do not accrue
            periodic funding.
          </p>
        </div>
        <PeriodSelector />
      </div>
    </header>
  );
}

function PeriodSelector() {
  // Selector is rendered to mirror the live UX, but stays disabled
  // until the backend exposes funding history. No data flows through
  // the dropdown — switching it cannot change what the table shows.
  return (
    <label
      data-testid="fundings-period-selector"
      className="flex items-center gap-2 text-[11px] text-zinc-500"
    >
      <span className="uppercase tracking-[0.12em]">Period</span>
      <select
        disabled
        aria-disabled="true"
        defaultValue={DEFAULT_PERIOD}
        title="Activates when DeOpt funding history lands on the backend."
        className="cursor-not-allowed rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[12px] text-zinc-300 disabled:opacity-60"
      >
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}

function OverviewTable() {
  return (
    <section
      data-testid="fundings-overview"
      aria-labelledby="fundings-overview-heading"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      <div className="flex items-center justify-between">
        <h2
          id="fundings-overview-heading"
          className="text-[16px] font-semibold text-zinc-100"
        >
          Overview
        </h2>
        <span
          data-testid="fundings-overview-source"
          className="text-[11px] text-zinc-500"
        >
          Source: DeOpt
        </span>
      </div>
      <div className="overflow-x-auto">
        <table
          data-testid="fundings-overview-table"
          className="w-full min-w-full border-separate border-spacing-0 text-[13px]"
        >
          <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <Th>Symbol</Th>
              <Th align="right">Funding Rate</Th>
              <Th align="right">Annualized</Th>
              <Th align="right">Next Funding</Th>
              <Th align="right">Status</Th>
              <Th align="right">Trade</Th>
            </tr>
          </thead>
          <tbody>
            {MARKETS.map((r, i) => (
              <tr
                key={r.symbol}
                data-testid={`fundings-overview-row-${i}`}
                className="hover:bg-zinc-900/40"
              >
                <Td>
                  <span
                    style={{ fontFamily: "var(--app-font-mono)" }}
                    className="text-zinc-100"
                  >
                    {r.symbol}
                  </span>
                </Td>
                <Td align="right" mono muted>
                  —
                </Td>
                <Td align="right" mono muted>
                  —
                </Td>
                <Td align="right" mono muted>
                  —
                </Td>
                <Td align="right">
                  <PlannedPill />
                </Td>
                <Td align="right">
                  <RowActions symbol={r.symbol} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500">
        Live DeOpt funding rates land when the perps executor and the
        funding endpoint ship. Until then every cell renders `—`.
      </p>
    </section>
  );
}

function RowActions({ symbol }: { symbol: string }) {
  const underlying = symbol.replace(/-PERP$/, "");
  // Internal links only — both routes already exist in the trading
  // shell. The underlying segment is informational and gets dropped
  // by the destination route if it is not a recognised filter.
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link
        href={`/perps?symbol=${encodeURIComponent(symbol)}`}
        data-testid={`fundings-action-perps-${symbol}`}
        className="rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
      >
        Perps
      </Link>
      <Link
        href={`/options?underlying=${encodeURIComponent(underlying)}`}
        data-testid={`fundings-action-options-${symbol}`}
        className="rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
      >
        Options
      </Link>
    </span>
  );
}

function AccountFundingPanel({ connected }: { connected: boolean }) {
  return (
    <section
      data-testid="fundings-account-panel"
      aria-label="Account funding"
      className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-black p-4 text-[13px]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          Account Funding
        </span>
        <span
          data-testid="fundings-account-state"
          className="text-zinc-300"
        >
          {connected
            ? "No payments found"
            : "Connect wallet to view account funding payments."}
        </span>
      </div>
    </section>
  );
}

function MethodologyNote() {
  return (
    <p
      data-testid="fundings-methodology-note"
      className="text-[12px] text-zinc-500"
    >
      Funding aligns perp mark price with index / oracle price. Longs or
      shorts may pay depending on the direction of the rate. Options
      positions do not pay periodic funding.{" "}
      <a
        href={docsPath("/protocol")}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="fundings-methodology-docs-link"
        className="text-emerald-300 underline-offset-2 hover:underline"
      >
        Read funding docs →
      </a>
    </p>
  );
}

// ── Primitives ────────────────────────────────────────────────────

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-zinc-900 px-3 py-2 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
  muted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  muted?: boolean;
}) {
  const base = `whitespace-nowrap border-b border-zinc-900 px-3 py-2.5 ${
    align === "right" ? "text-right" : "text-left"
  }`;
  const color = muted ? "text-zinc-500" : "text-zinc-100";
  return (
    <td
      className={`${base} ${color}`}
      style={mono ? { fontFamily: "var(--app-font-mono)" } : undefined}
    >
      {children}
    </td>
  );
}

function PlannedPill() {
  return (
    <span
      data-testid="fundings-planned-pill"
      className="inline-block rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400"
    >
      Planned
    </span>
  );
}
