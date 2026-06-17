"use client";

// FRONTEND-BACKEND-LEADERBOARD-V1 — terminal-style leaderboard page.
//
// Global (not wallet-scoped) ranking of accounts by trading volume,
// sourced from the new `GET /leaderboard` backend endpoint. Volume +
// trade count are aggregated from `option_fills`; realized PnL is
// reserved on the wire but rendered as `—` until settlement-event
// indexing lands. No fake live data.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchLeaderboard,
  type HistoryRange,
  type LeaderboardData,
  type LeaderboardItem,
} from "@/lib/trading-api";

interface RangeDef {
  id: HistoryRange;
  label: string;
}

const RANGES: RangeDef[] = [
  { id: "last_day",     label: "Last Day" },
  { id: "last_week",    label: "Last Week" },
  { id: "last_month",   label: "Last Month" },
  { id: "last_quarter", label: "Last Quarter" },
  { id: "all",          label: "All" },
];

const PAGE_SIZES = [100, 200, 500, 1000, 10000];

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatVolume1e8(raw?: string): string {
  if (!raw) return "—";
  // Convert from 1e8 base units to a fixed-2 decimal string. The
  // value can exceed Number.MAX_SAFE_INTEGER, so we use string-mode
  // BigInt arithmetic via the BigInt constructor (no `n` literals so
  // the file stays inside the configured TS target).
  try {
    const zero = BigInt(0);
    const scale = BigInt("100000000");
    const big = BigInt(raw);
    const negative = big < zero;
    const abs = negative ? -big : big;
    const whole = abs / scale;
    const frac = abs % scale;
    const fracStr = frac.toString().padStart(8, "0").slice(0, 2);
    const sign = negative ? "-" : "";
    return `${sign}${whole.toString()}.${fracStr}`;
  } catch {
    return raw;
  }
}

function pnlClass(value?: string): string {
  if (!value) return "text-zinc-500";
  if (value.startsWith("-")) return "text-red-400";
  if (value === "0" || value === "0.00") return "text-zinc-400";
  return "text-emerald-300";
}

interface LeaderboardState {
  loading: boolean;
  error: string | null;
  data: LeaderboardData | null;
}

export function LeaderboardShell() {
  const [range, setRange] = useState<HistoryRange>("last_month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pageInput, setPageInput] = useState("1");
  const [state, setState] = useState<LeaderboardState>({
    loading: false,
    error: null,
    data: null,
  });

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [range, pageSize]);

  const onSubmitPage = useCallback(() => {
    const v = Number.parseInt(pageInput, 10);
    if (Number.isFinite(v) && v >= 1) {
      setPage(v);
    } else {
      setPageInput(String(page));
    }
  }, [pageInput, page]);

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchLeaderboard({ range, page, pageSize, signal: ctrl.signal })
      .then((env) => {
        setState({ loading: false, error: null, data: env.data });
      })
      .catch((err: unknown) => {
        if (
          err &&
          typeof err === "object" &&
          (err as { name?: string }).name === "AbortError"
        ) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Unable to load leaderboard.";
        setState({
          loading: false,
          error: message.length > 160 ? "Unable to load leaderboard." : message,
          data: null,
        });
      });
    return () => ctrl.abort();
  }, [range, page, pageSize]);

  const items = useMemo(
    () => state.data?.items ?? [],
    [state.data],
  );
  const total = state.data?.total_records ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onExportCsv = useCallback(() => {
    const csv = buildCsv(items);
    downloadCsv(csvFilename(range), csv);
  }, [items, range]);

  return (
    <div
      data-testid="leaderboard-shell"
      data-leaderboard-range={range}
      className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-3 bg-black p-3 text-zinc-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-1">
        <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
          Ranked by 30-day trading volume
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span className="sr-only">Date range</span>
            <select
              data-testid="leaderboard-range-select"
              value={range}
              onChange={(e) => setRange(e.target.value as HistoryRange)}
              className="cursor-pointer rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
            >
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label="Export current view as CSV"
            data-testid="leaderboard-export-button"
            onClick={onExportCsv}
            title="Download the current view as CSV"
            className="grid h-7 w-7 place-items-center rounded border border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>

      <div
        data-testid="leaderboard-table-wrap"
        className="relative min-h-0 flex-1 overflow-auto border border-zinc-900"
      >
        <table className="w-full min-w-full border-separate border-spacing-0 font-mono text-[12px]">
          <thead className="sticky top-0 bg-zinc-950">
            <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">
                Rank
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-medium">
                Account
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">
                Volume
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">
                Trades
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">
                Realized PnL
              </th>
            </tr>
          </thead>
          <tbody data-testid="leaderboard-tbody">
            {state.loading ? (
              <EmptyRow
                colSpan={5}
                testid="leaderboard-loading"
                text="Loading…"
              />
            ) : state.error ? (
              <EmptyRow
                colSpan={5}
                testid="leaderboard-error"
                text={`Leaderboard unavailable: ${state.error}`}
              />
            ) : items.length === 0 ? (
              <EmptyRow
                colSpan={5}
                testid="leaderboard-empty"
                text="No accounts with recorded trading activity in this window."
              />
            ) : (
              items.map((it) => (
                <tr
                  key={it.address}
                  data-testid={`leaderboard-row-${it.rank}`}
                  className="border-b border-zinc-900/70 hover:bg-zinc-900/40"
                >
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-right text-zinc-300">
                    {it.rank}
                  </td>
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-left text-zinc-100">
                    {shortAddr(it.address)}
                  </td>
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-right text-zinc-100">
                    {formatVolume1e8(it.volume_1e8)}
                  </td>
                  <td className="whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-right text-zinc-100">
                    {it.trade_count}
                  </td>
                  <td
                    className={`whitespace-nowrap border-b border-zinc-900 px-3 py-2 text-right ${pnlClass(it.realized_pnl_1e8)}`}
                  >
                    {it.realized_pnl_1e8
                      ? formatVolume1e8(it.realized_pnl_1e8)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer
        data-testid="leaderboard-pagination"
        className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="leaderboard-page-prev"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600 hover:border-emerald-500/40"
          >
            Previous
          </button>
          <span className="text-zinc-500">Page</span>
          <input
            type="text"
            inputMode="numeric"
            data-testid="leaderboard-page-input"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={onSubmitPage}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitPage();
            }}
            className="w-12 rounded border border-zinc-800 bg-black/40 px-2 py-1 text-center text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
          <span className="text-zinc-500" data-testid="leaderboard-page-total">
            of {totalPages}
          </span>
          <button
            type="button"
            data-testid="leaderboard-page-next"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600 hover:border-emerald-500/40"
          >
            Next
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="sr-only">Page size</span>
            <select
              data-testid="leaderboard-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number.parseInt(e.target.value, 10))}
              className="cursor-pointer rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span
            data-testid="leaderboard-record-count"
            className="font-mono text-zinc-300"
          >
            {total} records
          </span>
        </div>
      </footer>
    </div>
  );
}

function EmptyRow({
  colSpan,
  testid,
  text,
}: {
  colSpan: number;
  testid: string;
  text: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        data-testid={testid}
        className="px-3 py-6 text-center text-[12px] text-zinc-500"
      >
        {text}
      </td>
    </tr>
  );
}

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildCsv(items: LeaderboardItem[]): string {
  const header = ["Rank", "Account", "Volume", "Trades", "RealizedPnL"]
    .map(csvEscape)
    .join(",");
  const rows = items.map((it) =>
    [
      String(it.rank),
      it.address,
      formatVolume1e8(it.volume_1e8),
      String(it.trade_count),
      it.realized_pnl_1e8 ? formatVolume1e8(it.realized_pnl_1e8) : "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header, ...rows].join("\r\n");
}

function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvFilename(range: HistoryRange): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `deopt-leaderboard-${range}-${stamp}.csv`;
}
