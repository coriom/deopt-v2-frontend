"use client";

import { useState } from "react";
import type { WidgetType, WorkspaceId } from "@/lib/workspace-types";
import { widgetsForWorkspace } from "./registry";

interface AddWidgetMenuProps {
  workspaceId: WorkspaceId;
  onAdd: (type: WidgetType) => void;
}

export function AddWidgetMenu({ workspaceId, onAdd }: AddWidgetMenuProps) {
  const [open, setOpen] = useState(false);
  const options = widgetsForWorkspace(workspaceId);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="workspace-add-widget"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded border border-emerald-500/40 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-500/10"
      >
        + Add widget
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Add widget"
          data-testid="workspace-add-widget-menu"
          className="absolute right-0 top-7 z-20 flex max-h-80 w-64 flex-col gap-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-2"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Add widget
          </div>
          {options.map((w) => (
            <button
              key={w.type}
              type="button"
              role="menuitem"
              data-testid={`workspace-add-widget-option-${w.type}`}
              onClick={() => {
                onAdd(w.type);
                setOpen(false);
              }}
              className="flex flex-col gap-0.5 rounded border border-transparent px-2 py-1 text-left hover:border-emerald-500/30 hover:bg-emerald-500/5"
            >
              <span className="flex items-center justify-between text-[11px] text-zinc-200">
                <span>{w.title}</span>
                {!w.implemented ? (
                  <span className="text-[9px] uppercase tracking-[0.18em] text-emerald-300">
                    coming later
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] text-zinc-500">{w.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
