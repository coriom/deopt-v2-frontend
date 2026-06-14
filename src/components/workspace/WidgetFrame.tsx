"use client";

import type { WidgetInstance } from "@/lib/workspace-types";
import type { WidgetDef } from "./registry";

interface WidgetFrameProps {
  instance: WidgetInstance;
  def: WidgetDef;
  onRemove: () => void;
}

/** Widget chrome. The header doubles as the drag handle via the
 *  `deopt-widget-drag-handle` className (react-grid-layout looks for
 *  this selector — set via the Workspace's `draggableHandle` prop).
 *  The resize handle is rendered by react-grid-layout itself in the
 *  bottom-right corner. */
export function WidgetFrame({ instance, def, onRemove }: WidgetFrameProps) {
  const Render = def.Render;
  return (
    <section
      data-testid={`widget-${instance.type}`}
      data-widget-id={instance.id}
      data-widget-implemented={def.implemented ? "true" : "false"}
      aria-label={def.title}
      className="flex h-full w-full flex-col gap-1 rounded border border-zinc-800 bg-zinc-950"
    >
      <header
        className="deopt-widget-drag-handle flex items-center justify-between gap-2 border-b border-zinc-900 px-2 py-1"
        data-testid={`widget-drag-handle-${instance.id}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            {def.title}
          </span>
          {!def.implemented ? (
            <span
              data-testid={`widget-status-${instance.type}`}
              className="rounded border border-emerald-500/30 px-1 py-0 text-[9px] text-emerald-200"
            >
              coming later
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          data-testid={`widget-remove-${instance.id}`}
          aria-label="Remove widget"
          className="rounded border border-transparent px-1 text-[10px] text-zinc-500 hover:border-zinc-700 hover:text-emerald-200"
        >
          ✕
        </button>
      </header>
      <div
        data-testid={`widget-body-${instance.type}`}
        className="min-h-0 flex-1 overflow-auto p-2"
      >
        <Render />
      </div>
    </section>
  );
}
