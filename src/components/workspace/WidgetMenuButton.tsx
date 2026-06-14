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
        className="rounded border border-emerald-500/40 px-2 py-0.5 text-[12px] text-emerald-200 hover:bg-emerald-500/10"
      >
        Widget
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Add widget"
          data-testid="navbar-widget-menu"
          className="absolute right-0 top-7 z-30 flex max-h-[70vh] w-72 flex-col gap-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-2"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Add widget
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
