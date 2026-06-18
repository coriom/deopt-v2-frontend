"use client";

// FRONTEND-OPTIONS-CHAIN-POLISH-V1 — rewrite of the chain grid with
// per-column visibility (toggled from the hamburger popover) and
// drag-and-drop reordering of column headers. Both sides (calls +
// puts) share the same visible-columns set and the same order so the
// grid stays symmetrical.
//
// Existing testids are preserved (`chain-row-*`, `chain-call-*`,
// `chain-put-*`, `chain-strike-*`, `options-chain-grid`,
// `options-chain-empty`) so existing e2e coverage continues to pass.

import { useState } from "react";
import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";
import { useChainColumnPrefs } from "@/hooks/useChainColumnPrefs";
import {
  COLUMN_REGISTRY,
  type ColumnId,
} from "@/lib/chain-columns";
import { ChainColumnsMenu } from "./ChainColumnsMenu";

interface OptionsChainGridProps {
  rows: OptionsChainRow[];
  selectedSeriesId: string | null;
  onSelect: (leg: OptionLeg, row: OptionsChainRow) => void;
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
}: OptionsChainGridProps) {
  const prefs = useChainColumnPrefs();
  const [dragId, setDragId] = useState<ColumnId | null>(null);

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

  const visible = prefs.visibleOrdered;
  // Single grid-template across the whole row: N call columns | strike | N put columns.
  // `minmax(3rem, 1fr)` keeps numeric cells compact but lets long ids
  // (e.g. exotic strike labels) breathe.
  const cellTpl = visible.map(() => "minmax(3rem,1fr)").join(" ");
  const rowTemplate = `${cellTpl || "1fr"} minmax(7rem,auto) ${cellTpl || "1fr"}`;

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

  return (
    <div
      data-testid="options-chain-grid"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      {/* Toolbar: titles + columns menu */}
      <div className="flex items-center justify-between border-b border-zinc-900 px-3 py-1">
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          <span className="text-emerald-300">Calls</span>
          <span>Strike</span>
          <span className="text-emerald-300">Puts</span>
        </div>
        <ChainColumnsMenu prefs={prefs} />
      </div>

      {/* Header row */}
      <div
        data-testid="chain-header-row"
        className="grid border-b border-zinc-800 bg-black/30 text-[10px] uppercase tracking-[0.12em] text-zinc-500"
        style={{ gridTemplateColumns: rowTemplate }}
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
        <div className="px-2 py-1 text-center text-zinc-400">Strike</div>
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

      {/* Body */}
      <div role="rowgroup">
        {rows.map((row) => {
          const callSelected =
            row.call.seriesId !== null &&
            row.call.seriesId === selectedSeriesId;
          const putSelected =
            row.put.seriesId !== null && row.put.seriesId === selectedSeriesId;
          const callDisabled = row.call.seriesId === null;
          const putDisabled = row.put.seriesId === null;
          return (
            <div
              key={`${row.strike1e8}-${row.expiryMs}`}
              data-testid={`chain-row-${row.strike1e8}-${row.expiryMs}`}
              className="grid border-b border-zinc-900 text-[11px] last:border-b-0"
              style={{ gridTemplateColumns: rowTemplate }}
            >
              {visible.map((id) => (
                <BodyCell
                  key={`call-${id}`}
                  side="call"
                  text={fmt(row.call, id)}
                  selected={callSelected}
                  disabled={callDisabled}
                  onClick={() => !callDisabled && onSelect(row.call, row)}
                  testid={
                    visible[0] === id
                      ? `chain-call-${row.strike1e8}-${row.expiryMs}`
                      : undefined
                  }
                  dataSelected={callSelected}
                  dataAvailable={!callDisabled}
                />
              ))}
              <div
                data-testid={`chain-strike-${row.strike1e8}-${row.expiryMs}`}
                className="flex flex-col items-center justify-center border-x border-zinc-900 bg-black/40 px-2 py-1 font-mono text-[12px] text-zinc-100"
              >
                <span>{row.strikeLabel}</span>
                <span className="text-[9px] text-zinc-500">
                  {row.expiryLabel}
                </span>
              </div>
              {visible.map((id) => (
                <BodyCell
                  key={`put-${id}`}
                  side="put"
                  text={fmt(row.put, id)}
                  selected={putSelected}
                  disabled={putDisabled}
                  onClick={() => !putDisabled && onSelect(row.put, row)}
                  testid={
                    visible[0] === id
                      ? `chain-put-${row.strike1e8}-${row.expiryMs}`
                      : undefined
                  }
                  dataSelected={putSelected}
                  dataAvailable={!putDisabled}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Footnote */}
      <div className="border-t border-zinc-800 bg-black/40 px-3 py-1.5 text-[10px] text-zinc-500">
        Only fields wired on the backend render real values; everything else
        renders &ldquo;{DASH}&rdquo;. Use the column menu to add bidIV / askIV
        / Vol / OI / Δ24% etc. as the sources land — drag a header to
        reorder.
      </div>
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
