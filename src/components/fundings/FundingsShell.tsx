"use client";

// FRONTEND-FUNDINGS-PAGE-V1 — minimal, honest funding landing.
//
// Perps are not live in this build, so the market funding table shows
// `Planned` rows with `—` placeholders for every numeric cell. No fake
// rates, no synthetic timestamps. The account table renders an honest
// empty state until a per-wallet funding-history endpoint ships on
// the backend.
//
// Long-form methodology and formulas live in `deopt-v2-docs`; this
// page links there rather than duplicating content locally.

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { docsPath } from "@/lib/docs-url";

interface MarketRow {
  market: string;
}

const MARKET_ROWS: MarketRow[] = [
  { market: "BTC-PERP" },
  { market: "ETH-PERP" },
];

export function FundingsShell() {
  const { address } = useWallet();
  const connected = !!address;
  return (
    <div
      data-testid="fundings-page"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-zinc-200"
    >
      <Header />
      <StatusStrip connected={connected} />
      <MarketFundingTable />
      <AccountFundingTable connected={connected} />
      <MethodologyCard />
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
        <nav
          aria-label="Funding quick links"
          data-testid="fundings-quicklinks"
          className="flex flex-wrap items-center gap-1.5 text-[11px]"
        >
          <a
            href={docsPath("/")}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="fundings-quicklink-docs"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Docs
          </a>
          <Link
            href="/perps"
            data-testid="fundings-quicklink-perps"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Perps
          </Link>
          <Link
            href="/fees"
            data-testid="fundings-quicklink-fees"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Fees
          </Link>
        </nav>
      </div>
    </header>
  );
}

function StatusStrip({ connected }: { connected: boolean }) {
  return (
    <section
      data-testid="fundings-status-strip"
      aria-label="Current status"
      className="grid gap-2 rounded-lg border border-zinc-800 bg-black p-4 sm:grid-cols-3"
    >
      <StatusCell
        testid="fundings-status-perps"
        label="Perps Funding"
        value="Not live"
        tone="muted"
      />
      <StatusCell
        testid="fundings-status-options"
        label="Options"
        value="No funding"
        tone="muted"
      />
      <StatusCell
        testid="fundings-status-account"
        label="Account Funding"
        value={connected ? "No payments found" : "Wallet not connected"}
        tone="muted"
      />
    </section>
  );
}

function StatusCell({
  testid,
  label,
  value,
  tone,
}: {
  testid: string;
  label: string;
  value: string;
  tone: "muted" | "ok";
}) {
  return (
    <div data-testid={testid} className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <span
        className={
          tone === "muted"
            ? "text-[14px] text-zinc-300"
            : "text-[14px] text-emerald-200"
        }
      >
        {value}
      </span>
    </div>
  );
}

function MarketFundingTable() {
  return (
    <section
      data-testid="fundings-market-section"
      aria-labelledby="fundings-market-heading"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      <h2
        id="fundings-market-heading"
        className="text-[16px] font-semibold text-zinc-100"
      >
        Market Funding
      </h2>
      <div className="overflow-x-auto">
        <table
          data-testid="fundings-market-table"
          className="w-full min-w-full border-separate border-spacing-0 text-[13px]"
        >
          <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <Th>Market</Th>
              <Th align="right">Funding Rate</Th>
              <Th align="right">Next Funding</Th>
              <Th align="right">24h Avg</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {MARKET_ROWS.map((r, i) => (
              <tr
                key={r.market}
                data-testid={`fundings-market-row-${i}`}
                className="hover:bg-zinc-900/40"
              >
                <Td>
                  <span
                    style={{ fontFamily: "var(--app-font-mono)" }}
                    className="text-zinc-100"
                  >
                    {r.market}
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
                  <StatusPill kind="planned">Planned</StatusPill>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccountFundingTable({ connected }: { connected: boolean }) {
  return (
    <section
      data-testid="fundings-account-section"
      aria-labelledby="fundings-account-heading"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      <h2
        id="fundings-account-heading"
        className="text-[16px] font-semibold text-zinc-100"
      >
        Account Funding
      </h2>
      <div className="overflow-x-auto">
        <table
          data-testid="fundings-account-table"
          className="w-full min-w-full border-separate border-spacing-0 text-[13px]"
        >
          <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <Th>Time</Th>
              <Th>Market</Th>
              <Th>Position</Th>
              <Th align="right">Rate</Th>
              <Th align="right">Payment</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={6}
                data-testid="fundings-account-empty"
                className="px-3 py-6 text-center text-[13px] text-zinc-500"
              >
                {connected
                  ? "No funding payments found"
                  : "Connect wallet to view account funding payments."}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MethodologyCard() {
  return (
    <section
      data-testid="fundings-methodology"
      aria-label="Funding methodology"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      <h2 className="text-[16px] font-semibold text-zinc-100">Methodology</h2>
      <ul className="flex flex-col gap-1 text-[13px] text-zinc-300">
        <li>
          Funding is used by perpetual markets to align mark price with
          index / oracle price.
        </li>
        <li>
          Longs or shorts may pay depending on the funding rate direction.
        </li>
        <li>Options positions do not pay periodic funding.</li>
      </ul>
      <a
        href={docsPath("/protocol")}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="fundings-methodology-docs-link"
        className="text-[12px] text-emerald-300 underline-offset-2 hover:underline"
      >
        Read funding docs →
      </a>
    </section>
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

function StatusPill({
  kind,
  children,
}: {
  kind: "planned";
  children: React.ReactNode;
}) {
  const klass =
    kind === "planned"
      ? "border-zinc-700 bg-zinc-900 text-zinc-300"
      : "border-zinc-700 bg-zinc-900 text-zinc-300";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${klass}`}
    >
      {children}
    </span>
  );
}
