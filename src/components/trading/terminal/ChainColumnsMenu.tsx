"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLUMN_REGISTRY,
  type ColumnId,
} from "@/lib/chain-columns";
import type { ChainColumnPrefs } from "@/hooks/useChainColumnPrefs";

interface ChainColumnsMenuProps {
  prefs: ChainColumnPrefs;
}

/**
 * Hamburger popover for the chain grid: lets the user show / hide
 * individual columns. The list follows the same order as the row
 * itself (driven by `prefs.order`) so the menu reflects the visible
 * layout.
 */
export function ChainColumnsMenu({ prefs }: ChainColumnsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" data-testid="chain-columns-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Show or hide columns"
        aria-expanded={open}
        data-testid="chain-columns-menu-button"
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
      >
        <HamburgerIcon />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Columns"
          data-testid="chain-columns-menu-panel"
          className="absolute right-0 z-40 mt-1 flex max-h-80 w-56 flex-col overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-[12px] text-zinc-200 shadow-lg deopt-scroll-dark"
        >
          <div className="flex items-center justify-between border-b border-zinc-900 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Columns
            </span>
            <button
              type="button"
              onClick={prefs.resetDefaults}
              data-testid="chain-columns-menu-reset"
              className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200"
            >
              Reset
            </button>
          </div>
          <ul className="mt-1 flex flex-col">
            {prefs.order.map((id) => (
              <ColumnRow key={id} id={id} prefs={prefs} />
            ))}
          </ul>
          <p className="mt-1 border-t border-zinc-900 pt-1 text-[10px] text-zinc-500">
            Drag a column header to reorder.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ColumnRow({ id, prefs }: { id: ColumnId; prefs: ChainColumnPrefs }) {
  const def = COLUMN_REGISTRY[id];
  const checked = prefs.visible.has(id);
  return (
    <li>
      <label
        data-testid={`chain-columns-menu-item-${id}`}
        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-emerald-500/5"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => prefs.toggle(id)}
          data-testid={`chain-columns-menu-toggle-${id}`}
          className="h-3.5 w-3.5 accent-emerald-500"
        />
        <span className="text-zinc-200">{def.label}</span>
      </label>
    </li>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="2" y1="4" x2="12" y2="4" />
      <line x1="2" y1="7" x2="12" y2="7" />
      <line x1="2" y1="10" x2="12" y2="10" />
    </svg>
  );
}
