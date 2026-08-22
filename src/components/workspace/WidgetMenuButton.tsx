"use client";

import { useEffect, useRef, useState } from "react";
import { useActiveWorkspace } from "@/lib/workspace-bridge";
import { widgetsForWorkspace } from "./registry";

/**
 * Navbar `Widget` button. Hidden when no workspace is active (e.g. on
 * /, /docs, /feedback). When a workspace IS active, the dropdown
 * lists the widgets that workspace supports. Click → adds the widget
 * to that workspace.
 */
export function WidgetMenuButton() {
  const active = useActiveWorkspace();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!active) return null;

  const options = widgetsForWorkspace(active.workspaceId);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="navbar-widget-button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="cursor-pointer rounded border border-transparent px-2 py-0.5 text-[12px] font-semibold text-zinc-100 hover:border-zinc-700 hover:text-white"
      >
        Widget
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Add widget"
          data-testid="navbar-widget-menu"
          className="deopt-scroll-dark absolute right-0 top-7 z-30 flex max-h-[70vh] w-72 flex-col gap-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              Add widget
            </span>
            <button
              type="button"
              role="menuitem"
              data-testid="navbar-widget-reset"
              title="Re-seed this workspace from the default layout (your customisations will be lost)."
              onClick={() => {
                active.resetLayout();
                setOpen(false);
              }}
              className="rounded border border-zinc-800 bg-black/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
            >
              Reset layout
            </button>
          </div>
          {options.map((w) => (
            <button
              key={w.type}
              type="button"
              role="menuitem"
              data-testid={`navbar-widget-option-${w.type}`}
              title={w.description}
              onClick={() => {
                active.addWidget(w.type);
                setOpen(false);
              }}
              className="flex items-center justify-between rounded border border-transparent px-2 py-1 text-left hover:border-emerald-500/30 hover:bg-emerald-500/5"
            >
              <span className="text-[11px] text-zinc-200">{w.title}</span>
              {!w.implemented ? (
                <span
                  data-testid={`navbar-widget-option-status-${w.type}`}
                  className="text-[9px] uppercase tracking-[0.18em] text-emerald-300"
                >
                  coming soon
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
