"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { WidgetInstance } from "@/lib/workspace-types";
import type { WidgetDef } from "./registry";

interface WidgetFrameProps {
  instance: WidgetInstance;
  def: WidgetDef;
  onRemove: () => void;
  /** Begin a drag-move gesture. The header captures pointer down and
   *  forwards it to the parent Workspace, which owns the pointer move
   *  / up listeners (so the gesture survives the cursor leaving the
   *  widget's bounding rect). */
  onDragStart: (e: ReactPointerEvent) => void;
  /** Begin a resize gesture from the bottom-right corner handle. */
  onResizeStart: (e: ReactPointerEvent) => void;
}

export function WidgetFrame({
  instance,
  def,
  onRemove,
  onDragStart,
  onResizeStart,
}: WidgetFrameProps) {
  const Render = def.Render;
  return (
    <section
      data-testid={`widget-${instance.type}`}
      data-widget-id={instance.id}
      data-widget-implemented={def.implemented ? "true" : "false"}
      aria-label={def.title}
      className="flex h-full w-full flex-col rounded border border-zinc-800 bg-zinc-950"
    >
      <header
        data-testid={`widget-drag-handle-${instance.id}`}
        onPointerDown={onDragStart}
        className="flex shrink-0 cursor-move items-center justify-between gap-2 overflow-hidden border-b border-zinc-900 px-2 py-1 select-none"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            {def.title}
          </span>
          {!def.implemented ? (
            <span
              data-testid={`widget-status-${instance.type}`}
              className="shrink-0 rounded border border-emerald-500/30 px-1 py-0 text-[9px] text-emerald-200"
            >
              coming later
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          data-testid={`widget-remove-${instance.id}`}
          aria-label="Remove widget"
          className="shrink-0 rounded border border-transparent px-1 text-[10px] text-zinc-500 hover:border-zinc-700 hover:text-emerald-200"
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
      <div
        data-testid={`widget-resize-handle-${instance.id}`}
        onPointerDown={onResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize widget"
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-r border-b border-emerald-500/40 hover:border-emerald-300"
      />
    </section>
  );
}
