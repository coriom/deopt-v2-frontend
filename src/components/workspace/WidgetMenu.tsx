"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { WidgetInstance } from "@/lib/workspace-types";
import type { WidgetDef } from "./registry";

interface WidgetMenuProps {
  instance: WidgetInstance;
  def: WidgetDef;
  onRemove: () => void;
}

/**
 * Kebab (⋯) menu that lives at the top-right of every widget. Replaces
 * the prior always-visible ✕ close button.
 *
 * Universal action: "Remove widget" — the shared Remove item preserves
 * the historical `data-testid="widget-remove-{id}"` so existing E2E
 * specs that click through to delete a widget continue to work; they
 * simply need to open the kebab menu first (updated in the same PR).
 *
 * Per-widget actions: rendered from `def.MenuActions` when the widget
 * exposes one. Kept as a stable extension point so future widget
 * settings (chart timeframe, chain filters, etc.) can be added
 * without touching this framework.
 */
export function WidgetMenu({ instance, def, onRemove }: WidgetMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(ev: MouseEvent | TouchEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (ev.target instanceof Node && el.contains(ev.target)) return;
      setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const MenuActions = def.MenuActions;
  // Prevent pointerdown on the menu (trigger + popover) from bubbling
  // into the section, otherwise the drag-move gesture kicks in on the
  // very click that toggles the menu.
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  const close = () => setOpen(false);

  return (
    <div
      ref={containerRef}
      data-testid={`widget-menu-${instance.id}`}
      data-open={open ? "true" : "false"}
      className="pointer-events-auto relative"
      onPointerDown={stop}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid={`widget-menu-trigger-${instance.id}`}
        aria-label="Widget menu"
        className="shrink-0 rounded border border-transparent bg-zinc-950/70 px-1 text-[12px] leading-none text-zinc-500 hover:border-zinc-700 hover:text-emerald-200"
      >
        ⋮
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`${def.title} actions`}
          data-testid={`widget-menu-popover-${instance.id}`}
          className="absolute right-0 top-full z-30 mt-1 flex min-w-[9rem] flex-col gap-0.5 rounded border border-zinc-800 bg-zinc-950 py-1 shadow-lg"
        >
          {MenuActions ? (
            <>
              <MenuActions close={close} />
              <div
                role="separator"
                className="mx-1 my-0.5 h-px bg-zinc-800"
                aria-hidden="true"
              />
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onRemove();
            }}
            data-testid={`widget-remove-${instance.id}`}
            className="px-3 py-1 text-left text-[11px] text-zinc-400 hover:bg-zinc-900 hover:text-red-300"
          >
            Remove widget
          </button>
        </div>
      ) : null}
    </div>
  );
}
