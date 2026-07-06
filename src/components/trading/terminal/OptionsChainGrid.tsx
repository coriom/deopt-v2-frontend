"use client";

// FRONTEND-OPTIONS-CHAIN-POLISH-V1 — rewrite of the chain grid with
// per-column visibility (toggled from the hamburger popover) and
// drag-and-drop reordering of column headers.
//
// The chain is rendered as TWO independent scrollable panels (calls +
// puts) separated by a fixed Strike column. Each side reads
// left-to-right in the same canonical order and their horizontal
// scroll positions are kept in sync via `onScroll` handlers — so
// scrolling right on either side reveals the same columns on both
// sides simultaneously.
//
// Existing testids are preserved (`chain-call-*`, `chain-put-*`,
// `chain-strike-*`, `options-chain-grid`, `options-chain-empty`) so
// existing e2e coverage continues to pass.

import { useRef, useState } from "react";
import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";
import {
  useChainColumnPrefs,
  type ChainColumnPrefs,
} from "@/hooks/useChainColumnPrefs";
import {
  COLUMN_REGISTRY,
  type ColumnId,
} from "@/lib/chain-columns";

interface OptionsChainGridProps {
  rows: OptionsChainRow[];
  selectedSeriesId: string | null;
  onSelect: (leg: OptionLeg, row: OptionsChainRow) => void;
  /** OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — fired when the
   *  user clicks a `bid` or `ask` cell that has a live price. The
   *  parent decides whether to append/toggle a Buy leg (Ask) or
   *  Sell leg (Bid) in the multi-leg store. When omitted or the
   *  column has no live price, cell click falls back to the legacy
   *  `onSelect` behaviour. */
  onCellAction?: (payload: {
    leg: OptionLeg;
    row: OptionsChainRow;
    columnId: ColumnId;
  }) => void;
  /** Set of `${seriesId}|${sourcePriceSide}` keys that are currently
   *  in the multi-leg selection — used to highlight bid/ask cells
   *  independently of the legacy single-leg `selectedSeriesId`. */
  selectedLegKeys?: Set<string>;
  /** Optional pre-hoisted prefs (so the ☰ menu can live in the
   *  banner and share state with the grid). When omitted the grid
   *  falls back to its own hook call — same underlying store. */
  prefs?: ChainColumnPrefs;
}

const DASH = "—";

function fmt(leg: OptionLeg, id: ColumnId): string {
  const v = COLUMN_REGISTRY[id].value(leg);
  return v ?? DASH;
}

export function OptionsChainGrid({
  rows,
  selectedSeriesId,
  onSelect,
  onCellAction,
  selectedLegKeys,
  prefs: prefsProp,
}: OptionsChainGridProps) {
  const localPrefs = useChainColumnPrefs();
  const prefs = prefsProp ?? localPrefs;
  const [dragId, setDragId] = useState<ColumnId | null>(null);
  const visible = prefs.visibleOrdered;
  // Each side (calls + puts) is rendered in its OWN horizontal-scroll
  // container. The `callsRef` / `putsRef` refs let `onScroll` handlers
  // mirror the `scrollLeft` between the two panels so both sides always
  // display the SAME subset of columns at any scroll position — the
  // Strike sits between them as a fixed, non-scrolling separator.
  const callsRef = useRef<HTMLDivElement>(null);
  const putsRef = useRef<HTMLDivElement>(null);
  const scrollLock = useRef(false);

  if (rows.length === 0) {
    return (
      <div
        data-testid="options-chain-empty"
        className="rounded-lg border border-emerald-500/30 bg-zinc-950 p-5 text-[12px] text-emerald-200"
      >
        <strong>No active series for this product yet.</strong>
        <p className="mt-1 text-zinc-400">
          The protocol publishes series on chain; the chain will populate once
          the operator registers strikes + expiries for the selected
          underlying. This is expected during testnet warm-up.
        </p>
      </div>
    );
  }
  // Per-side grid template. Both sides use the SAME template so the
  // same subset of columns is visible on both sides at any scroll
  // position. `minmax(3rem, 1fr)` keeps numeric cells compact but
  // lets long labels breathe.
  const sideTpl = visible.length > 0
    ? visible.map(() => "minmax(3rem,1fr)").join(" ")
    : "1fr";
  const sideGridStyle = { gridTemplateColumns: sideTpl };

  function onHeaderDragStart(id: ColumnId) {
    setDragId(id);
  }
  function onHeaderDragOver(e: React.DragEvent) {
    if (dragId) e.preventDefault();
  }
  function onHeaderDrop(overId: ColumnId) {
    if (dragId) {
      prefs.reorder(dragId, overId);
      setDragId(null);
    }
  }
  function onHeaderDragEnd() {
    setDragId(null);
  }

  // Sync horizontal scroll between the two side panels. The
  // `scrollLock` flag prevents the `onScroll` events from firing each
  // other into an infinite loop.
  function syncFromCalls(e: React.UIEvent<HTMLDivElement>) {
    if (scrollLock.current) return;
    const src = e.currentTarget.scrollLeft;
    if (putsRef.current && putsRef.current.scrollLeft !== src) {
      scrollLock.current = true;
      putsRef.current.scrollLeft = src;
      requestAnimationFrame(() => {
        scrollLock.current = false;
      });
    }
  }
  function syncFromPuts(e: React.UIEvent<HTMLDivElement>) {
    if (scrollLock.current) return;
    const src = e.currentTarget.scrollLeft;
    if (callsRef.current && callsRef.current.scrollLeft !== src) {
      scrollLock.current = true;
      callsRef.current.scrollLeft = src;
      requestAnimationFrame(() => {
        scrollLock.current = false;
      });
    }
  }

  return (
    <div
      data-testid="options-chain-grid"
      className="flex h-full min-h-0 flex-col"
    >
      {/* Toolbar: CALLS / <expiry date> / PUTS. Kept OUTSIDE the
          horizontal-scroll container so the section labels stay
          pinned to the widget frame while the columns beneath scroll
          left/right. The center slot shows the current expiry (all
          rows have been filtered by expiry upstream so
          `rows[0].expiryLabel` is representative). */}
      <div className="flex items-center border-b border-zinc-900 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
        <div className="flex-1 text-center text-emerald-300">Calls</div>
        <div
          data-testid="chain-toolbar-expiry"
          className="px-4 text-center font-mono normal-case tracking-normal text-zinc-300"
        >
          {rows[0]?.expiryLabel ?? ""}
        </div>
        <div className="flex-1 text-center text-emerald-300">Puts</div>
      </div>

      {/* Chain body: 3 flex columns
            [ calls scroll panel ] [ Strike fixed column ] [ puts scroll panel ]
          Calls and puts each own a horizontal scroll container; their
          `scrollLeft` positions are synced via `onScroll` so both
          sides always show the same subset of columns. */}
      <div className="flex min-h-0 flex-1">
        {/* Calls panel */}
        <div
          ref={callsRef}
          onScroll={syncFromCalls}
          data-testid="chain-calls-scroll"
          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div
            data-testid="chain-header-row-call"
            className="grid min-w-max border-b border-zinc-800 bg-black/30 text-[10px] uppercase tracking-[0.12em] text-zinc-500"
            style={sideGridStyle}
          >
            {visible.map((id) => (
              <HeaderCell
                key={`call-${id}`}
                id={id}
                side="call"
                dragId={dragId}
                onDragStart={() => onHeaderDragStart(id)}
                onDragOver={onHeaderDragOver}
                onDrop={() => onHeaderDrop(id)}
                onDragEnd={onHeaderDragEnd}
              />
            ))}
          </div>
          <div role="rowgroup">
            {rows.map((row) =>
              renderChainRow({
                side: "call",
                row,
                leg: row.call,
                visible,
                selectedSeriesId,
                selectedLegKeys,
                onSelect,
                onCellAction,
                sideGridStyle,
              }),
            )}
          </div>
        </div>

        {/* Strike column — fixed width, non-scrolling. */}
        <div
          data-testid="chain-strike-column"
          className="flex shrink-0 flex-col border-x border-zinc-800 bg-zinc-950 text-[10px] uppercase tracking-[0.12em] text-zinc-500"
          style={{ minWidth: "7rem" }}
        >
          <div className="border-b border-zinc-800 bg-black/30 px-2 py-1 text-center text-zinc-400">
            Strike
          </div>
          <div role="rowgroup" className="flex flex-1 flex-col">
            {rows.map((row) => (
              <div
                key={`strike-${row.strike1e8}-${row.expiryMs}`}
                data-testid={`chain-strike-${row.strike1e8}-${row.expiryMs}`}
                className="flex flex-1 items-center justify-center border-b border-zinc-900 px-2 py-1 font-mono text-[12px] text-zinc-100 last:border-b-0"
              >
                {row.strikeLabel}
              </div>
            ))}
          </div>
        </div>

        {/* Puts panel */}
        <div
          ref={putsRef}
          onScroll={syncFromPuts}
          data-testid="chain-puts-scroll"
          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div
            data-testid="chain-header-row-put"
            className="grid min-w-max border-b border-zinc-800 bg-black/30 text-[10px] uppercase tracking-[0.12em] text-zinc-500"
            style={sideGridStyle}
          >
            {visible.map((id) => (
              <HeaderCell
                key={`put-${id}`}
                id={id}
                side="put"
                dragId={dragId}
                onDragStart={() => onHeaderDragStart(id)}
                onDragOver={onHeaderDragOver}
                onDrop={() => onHeaderDrop(id)}
                onDragEnd={onHeaderDragEnd}
              />
            ))}
          </div>
          <div role="rowgroup">
            {rows.map((row) =>
              renderChainRow({
                side: "put",
                row,
                leg: row.put,
                visible,
                selectedSeriesId,
                selectedLegKeys,
                onSelect,
                onCellAction,
                sideGridStyle,
              }),
            )}
          </div>
        </div>
      </div>{/* /chain body 3-column flex */}

      {/* Footnote — outside the scroll container so it stays pinned. */}
      <div className="border-t border-zinc-800 bg-black/40 px-3 py-1.5 text-[10px] text-zinc-500">
        Only fields wired on the backend render real values; everything
        else renders &ldquo;{DASH}&rdquo;. Toggle columns via the ☰ menu;
        drag a header to reorder.
      </div>
    </div>
  );
}

// ── row + cell rendering ─────────────────────────────────────────

interface RenderChainRowProps {
  side: "call" | "put";
  row: OptionsChainRow;
  leg: OptionLeg;
  visible: ColumnId[];
  selectedSeriesId: string | null;
  selectedLegKeys?: Set<string>;
  onSelect: (leg: OptionLeg, row: OptionsChainRow) => void;
  onCellAction?: (payload: {
    leg: OptionLeg;
    row: OptionsChainRow;
    columnId: ColumnId;
  }) => void;
  sideGridStyle: React.CSSProperties;
}

function renderChainRow(props: RenderChainRowProps) {
  const {
    side,
    row,
    leg,
    visible,
    selectedSeriesId,
    selectedLegKeys,
    onSelect,
    onCellAction,
    sideGridStyle,
  } = props;
  const seriesId = leg.seriesId;
  const rowSelected = seriesId !== null && seriesId === selectedSeriesId;
  const rowDisabled = seriesId === null;
  return (
    <div
      key={`${side}-row-${row.strike1e8}-${row.expiryMs}`}
      className="grid min-w-max border-b border-zinc-900 text-[11px] last:border-b-0"
      style={sideGridStyle}
    >
      {visible.map((id) => {
        const text = fmt(leg, id);
        const isBid = id === "bid";
        const isAsk = id === "ask";
        const isPriceSide = isBid || isAsk;
        const priceLive =
          (isBid && leg.bidAvail === "live" && leg.bid !== null) ||
          (isAsk && leg.askAvail === "live" && leg.ask !== null);
        const priceCellKey = isBid
          ? seriesId !== null
            ? `${seriesId}|bid`
            : null
          : isAsk
            ? seriesId !== null
              ? `${seriesId}|ask`
              : null
            : null;
        const inMultiSelection =
          isPriceSide &&
          priceCellKey !== null &&
          selectedLegKeys?.has(priceCellKey) === true;
        // A bid/ask cell is clickable when the series exists AND a
        // live price is available AND the parent registered
        // `onCellAction`. All other cells fall back to the legacy
        // whole-row single-select behaviour.
        const cellClickable = isPriceSide
          ? priceLive && seriesId !== null && Boolean(onCellAction)
          : !rowDisabled;
        const cellDisabled = !cellClickable;
        const cellSelected = isPriceSide ? inMultiSelection : rowSelected;
        // Testids:
        //   * `chain-bid-{side}-{strike}-{expiry}` — bid button
        //   * `chain-ask-{side}-{strike}-{expiry}` — ask button
        //   * `chain-{call|put}-{strike}-{expiry}` — legacy first
        //      column marker (kept for regression coverage)
        let testid: string | undefined;
        if (isBid) {
          testid = `chain-bid-${side}-${row.strike1e8}-${row.expiryMs}`;
        } else if (isAsk) {
          testid = `chain-ask-${side}-${row.strike1e8}-${row.expiryMs}`;
        } else if (visible[0] === id) {
          testid = `chain-${side}-${row.strike1e8}-${row.expiryMs}`;
        }
        const onClick = () => {
          if (cellDisabled) return;
          if (isPriceSide && onCellAction) {
            onCellAction({ leg, row, columnId: id });
            return;
          }
          onSelect(leg, row);
        };
        return (
          <BodyCell
            key={`${side}-${id}`}
            side={side}
            text={text}
            selected={cellSelected}
            disabled={cellDisabled}
            onClick={onClick}
            testid={testid}
            dataSelected={cellSelected}
            dataAvailable={!cellDisabled}
          />
        );
      })}
    </div>
  );
}

// ── header + body cells ──────────────────────────────────────────

function HeaderCell({
  id,
  side,
  dragId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  id: ColumnId;
  side: "call" | "put";
  dragId: ColumnId | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const def = COLUMN_REGISTRY[id];
  const dragging = dragId === id;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-testid={`chain-header-${side}-${id}`}
      data-dragging={dragging ? "true" : "false"}
      className={`cursor-grab select-none px-2 py-1 text-right font-medium hover:text-emerald-200 ${
        dragging ? "opacity-50" : ""
      }`}
      title="Drag to reorder"
    >
      {def.label}
    </div>
  );
}

function BodyCell({
  side,
  text,
  selected,
  disabled,
  onClick,
  testid,
  dataSelected,
  dataAvailable,
}: {
  side: "call" | "put";
  text: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  testid?: string;
  dataSelected: boolean;
  dataAvailable: boolean;
}) {
  const base = `px-2 py-2 text-right font-mono ${
    side === "call" ? "" : ""
  }`;
  const state = disabled
    ? "cursor-not-allowed text-zinc-700"
    : selected
      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40"
      : "text-zinc-200 hover:bg-emerald-500/5 hover:text-emerald-200";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      data-selected={dataSelected ? "true" : "false"}
      data-available={dataAvailable ? "true" : "false"}
      className={`${base} ${state}`}
    >
      {text === DASH ? <span className="text-zinc-500">{DASH}</span> : text}
    </button>
  );
}
