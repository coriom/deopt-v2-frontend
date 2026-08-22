"use client";

// OPTIONS-CHAIN-WIDGET-MENU-V1 — column-visibility toggles rendered
// inside the shared widget kebab (⋮) menu instead of a dedicated
// hamburger button in the chain header. The hook
// (`useChainColumnPrefs`) is a localStorage-backed store with an
// in-memory listener set, so this menu and the OptionsChainGrid
// stay in sync automatically even though they're mounted in
// different trees.

import { useChainColumnPrefs } from "@/hooks/useChainColumnPrefs";
import { COLUMN_REGISTRY, type ColumnId } from "@/lib/chain-columns";

// Column toggles stay open while the user checks / unchecks — the
// shared kebab framework's `close` callback is intentionally unused
// here so multiple columns can be toggled in one gesture.
export function OptionsChainMenuActions() {
  const prefs = useChainColumnPrefs();

  return (
    <div
      data-testid="chain-columns-menu-panel"
      className="flex max-h-64 min-w-[13rem] flex-col overflow-y-auto px-1 py-1 text-[11px] text-zinc-200 deopt-scroll-dark"
    >
      <div className="flex items-center justify-between px-1 pb-1">
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
      <ul className="flex flex-col">
        {prefs.order.map((id) => (
          <ColumnRow key={id} id={id} prefs={prefs} />
        ))}
      </ul>
      <p className="mt-1 px-1 text-[10px] text-zinc-500">
        Drag a column header to reorder.
      </p>
    </div>
  );
}

function ColumnRow({
  id,
  prefs,
}: {
  id: ColumnId;
  prefs: ReturnType<typeof useChainColumnPrefs>;
}) {
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
