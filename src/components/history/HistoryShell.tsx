"use client";

// FRONTEND-BACKEND-HISTORY-V1 — terminal-style history page.
//
// Wallet-scoped, tabbed, paginated, range-filtered. Wires the new
// `/accounts/:address/history/v2` backend endpoint. No fake live data:
// when the wallet is disconnected, the table renders a polite
// "Connect wallet to view address-scoped history." row; when the
// backend is unavailable, a single muted error line replaces the rows
// (no internal URLs, no stack traces, no DB / secret leak).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet";
import {
  fetchHistoryV2,
  type HistoryRange,
  type HistoryTab,
  type HistoryV2Data,
  type HistoryV2Item,
} from "@/lib/trading-api";

interface TabDef {
  id: HistoryTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "trades",       label: "Trades" },
  { id: "transactions", label: "Transactions" },
  { id: "orders",       label: "Orders" },
  { id: "settlement",   label: "Settlement" },
  { id: "funding",      label: "Funding" },
  { id: "interest",     label: "Interest" },
  { id: "liquidations", label: "Liquidations" },
];

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

interface ColumnDef {
  id: string;
  label: string;
  /** Right-aligned numeric / monospace cells. */
  numeric?: boolean;
  render: (it: HistoryV2Item) => React.ReactNode;
  /** Optional CSV cell extractor; defaults to the value of the field
   *  named like the column id on `HistoryV2Item`. Time / hash / kind
   *  columns override to emit raw / full values. */
  csv?: (it: HistoryV2Item) => string;
}

function csvTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  return new Date(ms).toISOString();
}

function defaultCsv(it: HistoryV2Item, key: keyof HistoryV2Item): string {
  const v = it[key];
  if (v === undefined || v === null) return "";
  return String(v);
}

function shortTx(hash?: string): string {
  if (!hash) return "—";
  if (hash.length < 12) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function sideClass(side?: string): string {
  if (!side) return "text-zinc-400";
  if (side === "buy") return "text-emerald-300";
  if (side === "sell") return "text-red-400";
  return "text-zinc-300";
}

function pnlClass(value?: string): string {
  if (!value) return "text-zinc-400";
  if (value.startsWith("-")) return "text-red-400";
  if (value === "0" || value === "0.00") return "text-zinc-400";
  return "text-emerald-300";
}

function plainCell(value: string | undefined, fallback = "—"): React.ReactNode {
  if (!value) return <span className="text-zinc-500">{fallback}</span>;
  return value;
}

const timeCol = (): ColumnDef => ({
  id: "time",
  label: "Time",
  render: (it) => formatTime(it.time_ms),
  csv: (it) => csvTime(it.time_ms),
});
const txCol = (): ColumnDef => ({
  id: "tx",
  label: "Tx",
  render: (it) => <span className="font-mono text-zinc-400">{shortTx(it.tx_hash)}</span>,
  csv: (it) => it.tx_hash ?? "",
});

const COLUMNS: Record<HistoryTab, ColumnDef[]> = {
  trades: [
    timeCol(),
    { id: "instrument", label: "Instrument", render: (it) => plainCell(it.instrument) },
    { id: "side", label: "Side", render: (it) => <span className={sideClass(it.side)}>{it.side ?? "—"}</span> },
    { id: "amount", label: "Amount", numeric: true, render: (it) => plainCell(it.amount) },
    { id: "price", label: "Price", numeric: true, render: (it) => plainCell(it.price) },
    { id: "total", label: "Total", numeric: true, render: (it) => plainCell(it.total) },
    { id: "pnl", label: "PnL", numeric: true, render: (it) => <span className={pnlClass(it.pnl)}>{it.pnl ?? "—"}</span> },
    { id: "fees", label: "Fees", numeric: true, render: (it) => plainCell(it.fees) },
    { id: "status", label: "Status", render: (it) => plainCell(it.status) },
    { id: "type", label: "Type", render: (it) => plainCell(it.kind), csv: (it) => defaultCsv(it, "kind") },
    { id: "role", label: "Role", render: (it) => plainCell(it.role) },
    txCol(),
    { id: "share", label: "Share", render: () => <span className="text-zinc-600">—</span>, csv: () => "" },
  ],
  transactions: [
    timeCol(),
    txCol(),
    { id: "action", label: "Action", render: (it) => plainCell(it.action) },
    { id: "asset", label: "Asset", render: (it) => <span className="font-mono text-zinc-300">{it.asset ? shortTx(it.asset) : "—"}</span>, csv: (it) => defaultCsv(it, "asset") },
    { id: "amount", label: "Amount", numeric: true, render: (it) => plainCell(it.amount) },
    { id: "status", label: "Status", render: (it) => plainCell(it.status) },
    { id: "chain", label: "Chain", render: () => <span className="text-zinc-500">—</span>, csv: () => "" },
    { id: "block", label: "Block", numeric: true, render: (it) => it.block ? String(it.block) : <span className="text-zinc-500">—</span>, csv: (it) => defaultCsv(it, "block") },
    { id: "gas", label: "Gas", numeric: true, render: (it) => plainCell(it.gas) },
    { id: "explorer", label: "Explorer", render: () => <span className="text-zinc-600">—</span>, csv: () => "" },
  ],
  orders: [
    timeCol(),
    { id: "instrument", label: "Instrument", render: (it) => plainCell(it.instrument) },
    { id: "side", label: "Side", render: (it) => <span className={sideClass(it.side)}>{it.side ?? "—"}</span> },
    { id: "order_type", label: "Order Type", render: (it) => plainCell(it.order_type) },
    { id: "amount", label: "Amount", numeric: true, render: (it) => plainCell(it.amount) },
    { id: "limit", label: "Limit", numeric: true, render: (it) => plainCell(it.limit_price), csv: (it) => defaultCsv(it, "limit_price") },
    { id: "filled", label: "Filled", numeric: true, render: (it) => plainCell(it.filled) },
    { id: "status", label: "Status", render: (it) => plainCell(it.status) },
    { id: "role", label: "Role", render: (it) => plainCell(it.role) },
    txCol(),
  ],
  settlement: [
    timeCol(),
    { id: "instrument", label: "Instrument", render: (it) => plainCell(it.instrument) },
    { id: "settlement_type", label: "Settlement Type", render: (it) => plainCell(it.settlement_type) },
    { id: "amount", label: "Amount", numeric: true, render: (it) => plainCell(it.amount) },
    { id: "price", label: "Price", numeric: true, render: (it) => plainCell(it.price) },
    { id: "pnl", label: "PnL", numeric: true, render: (it) => <span className={pnlClass(it.pnl)}>{it.pnl ?? "—"}</span> },
    { id: "status", label: "Status", render: (it) => plainCell(it.status) },
    txCol(),
  ],
  funding: [
    timeCol(),
    { id: "market", label: "Market", render: (it) => plainCell(it.market) },
    { id: "position", label: "Position", render: (it) => plainCell(it.position) },
    { id: "rate", label: "Rate", numeric: true, render: (it) => plainCell(it.rate) },
    { id: "payment", label: "Payment", numeric: true, render: (it) => plainCell(it.payment) },
    { id: "status", label: "Status", render: (it) => plainCell(it.status) },
    txCol(),
  ],
  interest: [
    timeCol(),
    { id: "asset", label: "Asset", render: (it) => plainCell(it.asset) },
    { id: "principal", label: "Principal", numeric: true, render: (it) => plainCell(it.principal) },
    { id: "rate", label: "Rate", numeric: true, render: (it) => plainCell(it.rate) },
    { id: "interest", label: "Interest", numeric: true, render: (it) => plainCell(it.interest) },
    { id: "status", label: "Status", render: (it) => plainCell(it.status) },
    txCol(),
  ],
  liquidations: [
    timeCol(),
    { id: "instrument", label: "Instrument", render: (it) => plainCell(it.instrument) },
    { id: "side", label: "Side", render: (it) => <span className={sideClass(it.side)}>{it.side ?? "—"}</span> },
    { id: "size", label: "Size", numeric: true, render: (it) => plainCell(it.size) },
    { id: "liquidation_price", label: "Liquidation Price", numeric: true, render: (it) => plainCell(it.liquidation_price) },
    { id: "penalty", label: "Penalty", numeric: true, render: (it) => plainCell(it.penalty) },
    { id: "status", label: "Status", render: (it) => plainCell(it.status) },
    txCol(),
  ],
};

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(tab: HistoryTab, items: HistoryV2Item[]): string {
  const cols = COLUMNS[tab];
  const header = cols.map((c) => csvEscape(c.label)).join(",");
  const rows = items.map((it) =>
    cols
      .map((c) => {
        const raw = c.csv
          ? c.csv(it)
          : defaultCsv(it, c.id as keyof HistoryV2Item);
        return csvEscape(raw);
      })
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
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvFilename(tab: HistoryTab, range: HistoryRange): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `deopt-history-${tab}-${range}-${stamp}.csv`;
}

interface HistoryState {
  loading: boolean;
  error: string | null;
  data: HistoryV2Data | null;
}

export function HistoryShell() {
  const { address } = useWallet();
  const [tab, setTab] = useState<HistoryTab>("trades");
  const [range, setRange] = useState<HistoryRange>("last_month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pageInput, setPageInput] = useState("1");
  const [state, setState] = useState<HistoryState>({
    loading: false,
    error: null,
    data: null,
  });

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  // Reset to page 1 whenever the tab, range, or page size changes.
  useEffect(() => {
    setPage(1);
  }, [tab, range, pageSize]);

  const onSubmitPage = useCallback(() => {
    const v = Number.parseInt(pageInput, 10);
    if (Number.isFinite(v) && v >= 1) {
      setPage(v);
    } else {
      setPageInput(String(page));
    }
  }, [pageInput, page]);

  useEffect(() => {
    if (!address) {
      setState({ loading: false, error: null, data: null });
      return;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchHistoryV2(address, { tab, range, page, pageSize, signal: ctrl.signal })
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
          err instanceof Error ? err.message : "Unable to load history.";
        setState({
          loading: false,
          error: message.length > 160 ? "Unable to load history." : message,
          data: null,
        });
      });
    return () => ctrl.abort();
  }, [address, tab, range, page, pageSize]);

  const columns = COLUMNS[tab];
  const items = useMemo(
    () => state.data?.items ?? [],
    [state.data],
  );
  const total = state.data?.total_records ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Export is always available — when there are zero records the
  // generated file contains just the header row so the user still
  // gets a usable column template.
  const onExportCsv = useCallback(() => {
    const csv = buildCsv(tab, items);
    downloadCsv(csvFilename(tab, range), csv);
  }, [items, tab, range]);

  const headerRow = useMemo(
    () => (
      <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
        {columns.map((c) => (
          <th
            key={c.id}
            scope="col"
            data-testid={`history-col-${tab}-${c.id}`}
            className={`whitespace-nowrap px-3 py-2 font-medium ${
              c.numeric ? "text-right" : "text-left"
            }`}
          >
            {c.label}
          </th>
        ))}
      </tr>
    ),
    [columns, tab],
  );

  return (
    <div
      data-testid="history-shell"
      data-history-tab={tab}
      data-history-range={range}
      className="flex h-full min-h-0 flex-col gap-3 bg-black p-3 text-zinc-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-1">
        <nav
          role="tablist"
          aria-label="History tabs"
          data-testid="history-tabs"
          className="flex flex-wrap items-center"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              data-testid={`history-tab-${t.id}`}
              data-active={t.id === tab ? "true" : "false"}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b px-3 py-2 text-[12px] font-medium transition-colors ${
                t.id === tab
                  ? "border-zinc-100 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span className="sr-only">Date range</span>
            <select
              data-testid="history-range-select"
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
            data-testid="history-export-button"
            onClick={onExportCsv}
            title="Download the current view as CSV"
            className="grid h-7 w-7 place-items-center rounded border border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>

      <div
        data-testid="history-table-wrap"
        className="relative min-h-0 flex-1 overflow-auto border border-zinc-900"
      >
        <table className="w-full min-w-full border-separate border-spacing-0 font-mono text-[12px]">
          <thead className="sticky top-0 bg-zinc-950">{headerRow}</thead>
          <tbody data-testid="history-tbody">
            {!address ? (
              <EmptyRow
                colSpan={columns.length}
                testid="history-empty-disconnected"
                text="Connect wallet to view address-scoped history."
              />
            ) : state.loading ? (
              <EmptyRow
                colSpan={columns.length}
                testid="history-loading"
                text="Loading…"
              />
            ) : state.error ? (
              <EmptyRow
                colSpan={columns.length}
                testid="history-error"
                text={`History unavailable: ${state.error}`}
              />
            ) : items.length === 0 ? (
              <EmptyRow
                colSpan={columns.length}
                testid={`history-empty-${tab}`}
                text={`No ${tab} found.`}
              />
            ) : (
              items.map((it, i) => (
                <tr
                  key={i}
                  data-testid={`history-row-${tab}-${i}`}
                  className="border-b border-zinc-900/70 hover:bg-zinc-900/40"
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={`whitespace-nowrap border-b border-zinc-900 px-3 py-2 ${
                        c.numeric ? "text-right" : "text-left"
                      }`}
                    >
                      {c.render(it)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer
        data-testid="history-pagination"
        className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="history-page-prev"
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
            data-testid="history-page-input"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={onSubmitPage}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitPage();
            }}
            className="w-12 rounded border border-zinc-800 bg-black/40 px-2 py-1 text-center text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
          <span className="text-zinc-500" data-testid="history-page-total">
            of {totalPages}
          </span>
          <button
            type="button"
            data-testid="history-page-next"
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
              data-testid="history-page-size"
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
          <span data-testid="history-record-count" className="font-mono text-zinc-300">
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
