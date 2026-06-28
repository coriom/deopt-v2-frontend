"use client";

// FRONTEND-BACKEND-HISTORY-V1 — terminal-style history page.
// HISTORY-LIFECYCLE-V2 — extended with a `conditional` (TP/SL) tab
// backed by `/accounts/:address/conditional-orders`, plus a
// lifecycle-driven refresh banner that surfaces "New activity" when
// the private WS channels fire while the user is on this page.
//
// Wallet-scoped, tabbed, paginated, range-filtered. The seven legacy
// tabs (Trades / Transactions / Orders / Settlement / Funding /
// Interest / Liquidations) still wire `/accounts/:address/history/v2`;
// the new `Conditional` tab fetches conditional-order rows directly
// and applies range + pagination client-side because they aren't
// served by `history/v2` yet.
//
// No fake live data: when the wallet is disconnected, the table
// renders a polite "Connect wallet to view address-scoped history."
// row; when the backend is unavailable, a single muted error line
// replaces the rows (no internal URLs, no stack traces, no DB /
// secret leak).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet";
import {
  fetchHistoryV2,
  listConditionalOrders,
  type HistoryRange,
  type HistoryTab,
  type HistoryV2Data,
  type HistoryV2Item,
} from "@/lib/trading-api";
import type { ConditionalOrderResponse } from "@/lib/trading-types";
import {
  isTerminalConditionalStatus,
  shortId,
  sliceConditionalHistory,
} from "@/lib/history-conditional";
import {
  deriveOrderReason,
  type HistoryReason,
  type ReasonSeverity,
} from "@/lib/history-reasons";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import { LifecycleStatusBadge } from "@/components/trading/LifecycleStatusBadge";

// Local superset of the backend HistoryTab. The `"conditional"` tab is
// served by a different endpoint, so the fetch logic branches on it
// and we never pass it through to `fetchHistoryV2`.
type ShellTab = HistoryTab | "conditional";

interface TabDef {
  id: ShellTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "trades",       label: "Trades" },
  { id: "transactions", label: "Transactions" },
  { id: "orders",       label: "Orders" },
  { id: "conditional",  label: "TP / SL" },
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

// HISTORY-V2-FAILURE-REASONS-V1 — render a HistoryReason as a compact
// coloured cell. The `code` is the dense, copy-paste-friendly token;
// the human-readable `message` lives in the `title` attribute so
// hover-to-explain works without widening the table.
function reasonClass(severity: ReasonSeverity): string {
  if (severity === "error") return "text-red-400";
  if (severity === "warning") return "text-amber-300";
  return "text-zinc-400";
}

function renderReasonCell(reason: HistoryReason | null): React.ReactNode {
  if (!reason) return <span className="text-zinc-600">—</span>;
  return (
    <span
      data-reason-code={reason.code}
      data-reason-severity={reason.severity}
      {...(reason.source ? { "data-reason-source": reason.source } : {})}
      title={reason.message}
      className={reasonClass(reason.severity)}
    >
      {reason.code}
    </span>
  );
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
    { id: "reason", label: "Reason", render: (it) => renderReasonCell(deriveOrderReason(it)), csv: (it) => deriveOrderReason(it)?.code ?? "" },
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

// HISTORY-LIFECYCLE-V2 — column model for the Conditional / TP-SL tab.
// Mirrors the ConditionalOrderResponse shape; rows whose status is in
// `TERMINAL_CONDITIONAL_STATUSES` are visually muted by the row class.
interface ConditionalColumnDef {
  id: string;
  label: string;
  numeric?: boolean;
  render: (it: ConditionalOrderResponse) => React.ReactNode;
  csv: (it: ConditionalOrderResponse) => string;
}

function statusBadgeClass(status: string): string {
  if (isTerminalConditionalStatus(status)) {
    if (status === "failed" || status === "expired") return "text-red-400";
    if (status === "cancelled") return "text-zinc-500";
    return "text-zinc-400";
  }
  // armed / pending
  return "text-emerald-300";
}

const CONDITIONAL_COLUMNS: ConditionalColumnDef[] = [
  {
    id: "time",
    label: "Time",
    render: (it) => formatTime(it.updated_at_ms),
    csv: (it) => csvTime(it.updated_at_ms),
  },
  {
    id: "instrument",
    label: "Instrument",
    render: (it) => <span className="font-mono text-zinc-300">{shortId(it.option_series_id)}</span>,
    csv: (it) => it.option_series_id,
  },
  {
    id: "side",
    label: "Side",
    render: (it) => <span className="text-zinc-300">{it.position_side}</span>,
    csv: (it) => it.position_side,
  },
  {
    id: "trigger_type",
    label: "Trigger",
    render: (it) => <span className="uppercase tracking-wide text-zinc-300">{it.conditional_type}</span>,
    csv: (it) => it.conditional_type,
  },
  {
    id: "trigger_price",
    label: "Trigger Price (1e8)",
    numeric: true,
    render: (it) => <span className="font-mono">{it.trigger_price_1e8}</span>,
    csv: (it) => it.trigger_price_1e8,
  },
  {
    id: "size",
    label: "Size (1e8)",
    numeric: true,
    render: (it) => <span className="font-mono">{it.quantity_1e8}</span>,
    csv: (it) => it.quantity_1e8,
  },
  {
    id: "status",
    label: "Status",
    render: (it) => <span className={statusBadgeClass(it.status)}>{it.status}</span>,
    csv: (it) => it.status,
  },
  {
    id: "child_order",
    label: "Child Order",
    render: (it) =>
      it.child_order_id
        ? <span className="font-mono text-zinc-400" title={it.child_order_id}>{shortId(it.child_order_id)}</span>
        : <span className="text-zinc-600">—</span>,
    csv: (it) => it.child_order_id ?? "",
  },
  {
    id: "oco_group",
    label: "OCO Group",
    render: (it) =>
      it.oco_group_id
        ? <span className="font-mono text-zinc-400" title={it.oco_group_id}>{shortId(it.oco_group_id)}</span>
        : <span className="text-zinc-600">—</span>,
    csv: (it) => it.oco_group_id ?? "",
  },
  {
    id: "failure",
    label: "Failure",
    render: (it) => {
      if (!it.failure_code && !it.failure_message) {
        return <span className="text-zinc-600">—</span>;
      }
      const code = it.failure_code ?? "error";
      const msg = it.failure_message ?? "";
      return (
        <span className="text-red-400" title={msg || code}>
          {code}
        </span>
      );
    },
    csv: (it) => it.failure_code ? `${it.failure_code}${it.failure_message ? `: ${it.failure_message}` : ""}` : "",
  },
];

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

function buildConditionalCsv(items: ConditionalOrderResponse[]): string {
  const cols = CONDITIONAL_COLUMNS;
  const header = cols.map((c) => csvEscape(c.label)).join(",");
  const rows = items.map((it) =>
    cols.map((c) => csvEscape(c.csv(it))).join(","),
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

function csvFilename(tab: ShellTab, range: HistoryRange): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `deopt-history-${tab}-${range}-${stamp}.csv`;
}

interface HistoryV2State {
  loading: boolean;
  error: string | null;
  data: HistoryV2Data | null;
}

interface ConditionalState {
  loading: boolean;
  error: string | null;
  rows: ConditionalOrderResponse[];
  /** Wall-clock time the rows were captured; used as the `nowMs`
   *  anchor for client-side range filtering. Captured at fetch time so
   *  render passes stay pure (no Date.now() inside useMemo). */
  fetchedAtMs: number;
}

function shortenError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Unable to load history.";
  return message.length > 160 ? "Unable to load history." : message;
}

function isAbort(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { name?: string }).name === "AbortError";
}

export function HistoryShell() {
  const { address } = useWallet();
  const [tab, setTab] = useState<ShellTab>("trades");
  const [range, setRange] = useState<HistoryRange>("last_month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pageInput, setPageInput] = useState("1");
  const [v2State, setV2State] = useState<HistoryV2State>({
    loading: false,
    error: null,
    data: null,
  });
  const [condState, setCondState] = useState<ConditionalState>({
    loading: false,
    error: null,
    rows: [],
    fetchedAtMs: 0,
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(false);

  const lifecycle = useLifecycleStream();
  const lifecycleSubscribe = lifecycle.subscribe;
  const lifecycleResyncToken = lifecycle.resyncToken;

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

  // HISTORY-LIFECYCLE-V2 — surface a "New activity available" banner
  // whenever a private lifecycle WS delta arrives. We never silently
  // mutate the visible page because pagination + range filters make
  // mid-page row injection visually unstable; the banner pattern lets
  // the user choose when to fold in the new state.
  useEffect(() => {
    if (!address) return;
    const flag = () => setBannerVisible(true);
    const unsubs = [
      lifecycleSubscribe("account.orders", flag),
      lifecycleSubscribe("account.fills", flag),
      lifecycleSubscribe("account.conditional_orders", flag),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [address, lifecycleSubscribe]);

  // HISTORY-LIFECYCLE-V2 — on WS reconnect (resync), silently refresh
  // the current view so we don't show stale data after a missed event.
  // We start the lifecycle hook at resyncToken=0 (initial), so we only
  // bump the refresh on the FIRST > 0 transition and every increment
  // after that. The banner is cleared at the same time because the
  // refetch covers whatever the banner was alerting about.
  useEffect(() => {
    if (lifecycleResyncToken === 0) return;
    setRefreshNonce((n) => n + 1);
    setBannerVisible(false);
  }, [lifecycleResyncToken]);

  // V2 tabs: fetch from `/accounts/:address/history/v2`. Skips the
  // conditional tab entirely so we don't send an unknown tab string to
  // the backend (it would 400 with InvalidRequest).
  useEffect(() => {
    if (!address || tab === "conditional") {
      return;
    }
    const ctrl = new AbortController();
    setV2State((s) => ({ ...s, loading: true, error: null }));
    fetchHistoryV2(address, { tab, range, page, pageSize, signal: ctrl.signal })
      .then((env) => {
        setV2State({ loading: false, error: null, data: env.data });
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        setV2State({ loading: false, error: shortenError(err), data: null });
      });
    return () => ctrl.abort();
  }, [address, tab, range, page, pageSize, refreshNonce]);

  // Reset v2 state on disconnect so we don't leak the previous wallet's
  // rows after a wallet swap.
  useEffect(() => {
    if (!address) {
      setV2State({ loading: false, error: null, data: null });
      setCondState({ loading: false, error: null, rows: [], fetchedAtMs: 0 });
      setBannerVisible(false);
    }
  }, [address]);

  // Conditional tab: full-snapshot fetch; range + pagination apply
  // client-side via `sliceConditionalHistory`. We refetch on
  // (address, refreshNonce) transitions only; changing range / page
  // does NOT hit the network — the slice is recomputed locally.
  useEffect(() => {
    if (!address || tab !== "conditional") {
      return;
    }
    const ctrl = new AbortController();
    setCondState((s) => ({ ...s, loading: true, error: null }));
    listConditionalOrders(address, ctrl.signal)
      .then((rows) => {
        setCondState({
          loading: false,
          error: null,
          rows,
          fetchedAtMs: Date.now(),
        });
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        setCondState({
          loading: false,
          error: shortenError(err),
          rows: [],
          fetchedAtMs: 0,
        });
      });
    return () => ctrl.abort();
  }, [address, tab, refreshNonce]);

  const isConditional = tab === "conditional";

  const condSlice = useMemo(() => {
    if (!isConditional) return { total: 0, page_items: [] as ConditionalOrderResponse[] };
    // Anchor the range filter at fetch time so the render pass is pure
    // (the React `react-hooks/purity` rule rejects `Date.now()` here).
    // The cutoff freezes per fetch; clicking refresh picks up a fresh
    // anchor at the next `listConditionalOrders` resolve.
    const nowMs = condState.fetchedAtMs || 0;
    return sliceConditionalHistory(condState.rows, {
      range,
      nowMs,
      page,
      pageSize,
    });
  }, [isConditional, condState.rows, condState.fetchedAtMs, range, page, pageSize]);

  const loading = isConditional ? condState.loading : v2State.loading;
  const error = isConditional ? condState.error : v2State.error;
  const total = isConditional ? condSlice.total : (v2State.data?.total_records ?? 0);
  const v2Items = useMemo(
    () => v2State.data?.items ?? [],
    [v2State.data],
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const v2Columns = isConditional ? null : COLUMNS[tab];
  const colCount = isConditional ? CONDITIONAL_COLUMNS.length : (v2Columns?.length ?? 0);

  // Export is always available — when there are zero records the
  // generated file contains just the header row so the user still
  // gets a usable column template.
  const onExportCsv = useCallback(() => {
    if (isConditional) {
      const csv = buildConditionalCsv(condSlice.page_items);
      downloadCsv(csvFilename(tab, range), csv);
    } else {
      const csv = buildCsv(tab, v2Items);
      downloadCsv(csvFilename(tab, range), csv);
    }
  }, [isConditional, condSlice.page_items, v2Items, tab, range]);

  const onRefreshClick = useCallback(() => {
    setBannerVisible(false);
    setRefreshNonce((n) => n + 1);
  }, []);

  const headerRow = useMemo(() => {
    const cols = isConditional
      ? CONDITIONAL_COLUMNS.map((c) => ({ id: c.id, label: c.label, numeric: c.numeric }))
      : (v2Columns ?? []).map((c) => ({ id: c.id, label: c.label, numeric: c.numeric }));
    return (
      <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
        {cols.map((c) => (
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
    );
  }, [isConditional, v2Columns, tab]);

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
          <LifecycleStatusBadge
            status={lifecycle.status}
            detail={lifecycle.statusDetail}
          />
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
            aria-label="Refresh history"
            data-testid="history-refresh-button"
            onClick={onRefreshClick}
            title="Refetch the current view"
            className="grid h-7 w-7 place-items-center rounded border border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            <span aria-hidden="true">↻</span>
          </button>
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

      {bannerVisible && address && (
        <button
          type="button"
          data-testid="history-refresh-banner"
          onClick={onRefreshClick}
          className="flex items-center justify-between gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-left text-[11px] text-emerald-200 hover:bg-emerald-500/20"
        >
          <span>New activity available — refresh to see the latest rows.</span>
          <span aria-hidden="true" className="text-emerald-300">↻ Refresh</span>
        </button>
      )}

      <div
        data-testid="history-table-wrap"
        className="relative min-h-0 flex-1 overflow-auto border border-zinc-900"
      >
        <table className="w-full min-w-full border-separate border-spacing-0 font-mono text-[12px]">
          <thead className="sticky top-0 bg-zinc-950">{headerRow}</thead>
          <tbody data-testid="history-tbody">
            {!address ? (
              <EmptyRow
                colSpan={colCount}
                testid="history-empty-disconnected"
                text="Connect wallet to view address-scoped history."
              />
            ) : loading ? (
              <EmptyRow
                colSpan={colCount}
                testid="history-loading"
                text="Loading…"
              />
            ) : error ? (
              <EmptyRow
                colSpan={colCount}
                testid="history-error"
                text={`History unavailable: ${error}`}
              />
            ) : isConditional ? (
              condSlice.page_items.length === 0 ? (
                <EmptyRow
                  colSpan={colCount}
                  testid="history-empty-conditional"
                  text="No conditional orders found."
                />
              ) : (
                condSlice.page_items.map((it, i) => (
                  <tr
                    key={it.id}
                    data-testid={`history-row-conditional-${i}`}
                    data-conditional-status={it.status}
                    data-conditional-terminal={isTerminalConditionalStatus(it.status) ? "true" : "false"}
                    className={`border-b border-zinc-900/70 hover:bg-zinc-900/40 ${
                      isTerminalConditionalStatus(it.status) ? "opacity-70" : ""
                    }`}
                  >
                    {CONDITIONAL_COLUMNS.map((c) => (
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
              )
            ) : v2Items.length === 0 ? (
              <EmptyRow
                colSpan={colCount}
                testid={`history-empty-${tab}`}
                text={`No ${tab} found.`}
              />
            ) : (
              v2Items.map((it, i) => (
                <tr
                  key={i}
                  data-testid={`history-row-${tab}-${i}`}
                  className="border-b border-zinc-900/70 hover:bg-zinc-900/40"
                >
                  {(v2Columns ?? []).map((c) => (
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
