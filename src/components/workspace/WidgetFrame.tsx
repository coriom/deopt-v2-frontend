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
  // The whole widget acts as a drag handle, but interactive descendants
  // (buttons, inputs, tabs, links) should NOT start a drag — otherwise
  // beginDrag's preventDefault() would swallow their click. We gate the
  // drag start on the event target so internal controls keep working.
  const handleSectionPointerDown = (e: ReactPointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, input, select, textarea, a, [role="tab"], [role="button"], [data-no-drag]',
      )
    ) {
      return;
    }
    onDragStart(e);
  };
  return (
    <section
      data-testid={`widget-${instance.type}`}
      data-widget-id={instance.id}
      data-widget-implemented={def.implemented ? "true" : "false"}
      aria-label={def.title}
      title={def.title}
      onPointerDown={handleSectionPointerDown}
      className="relative flex h-full w-full cursor-move flex-col rounded border border-zinc-900 bg-zinc-950 select-none"
    >
      {/* Full-section drag handle. pointer-events-none so events fall
          through to <section>; tests still locate it by testid. */}
      <span
        data-testid={`widget-drag-handle-${instance.id}`}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
      />
      <div
        data-testid={`widget-body-${instance.type}`}
        className="deopt-scroll-dark min-h-0 flex-1 overflow-auto"
      >
        <Render />
      </div>
      {/* Top-right action cluster — aligns with the first row of body
          content (status badge + close cross). Container is
          pointer-events-none so empty space passes drags through to
          the section; only the badge and the button capture clicks. */}
      <div
        data-testid={`widget-actions-${instance.id}`}
        className="pointer-events-none absolute top-1 right-1.5 z-10 flex items-center gap-1.5"
      >
        {!def.implemented ? (
          <span
            data-testid={`widget-status-${instance.type}`}
            className="pointer-events-auto shrink-0 rounded border border-emerald-500/30 bg-zinc-950/80 px-1 py-0 text-[9px] leading-tight text-emerald-200"
          >
            coming later
          </span>
        ) : null}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          data-testid={`widget-remove-${instance.id}`}
          aria-label="Remove widget"
          className="pointer-events-auto shrink-0 rounded border border-transparent bg-zinc-950/70 px-1 text-[10px] leading-tight text-zinc-500 hover:border-zinc-700 hover:text-emerald-200"
        >
          ✕
        </button>
      </div>
      <div
        data-testid={`widget-resize-handle-${instance.id}`}
        onPointerDown={onResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize widget"
        // Larger hit area (16px instead of 12px) and inset 2px from
        // the corner so the handle is always grabbable even if the
        // browser's scrollbar gutter ever sneaks pixels back.
        className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-se-resize border-r border-b border-emerald-500/40 hover:border-emerald-300"
      />
    </section>
  );
}
