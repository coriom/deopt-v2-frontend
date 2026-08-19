"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { WidgetInstance } from "@/lib/workspace-types";
import type { WidgetDef } from "./registry";
import { WidgetMenu } from "./WidgetMenu";

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
      className="group relative flex h-full w-full cursor-move flex-col rounded border border-zinc-900 bg-zinc-950 select-none"
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
      {/* Top-right action cluster — status badge + kebab (⋯) menu.
          Container is pointer-events-none so empty space passes drags
          through to the section; only the badge and the menu capture
          clicks. The kebab replaces the prior always-visible ✕ close
          button and includes "Remove widget" plus any per-widget
          settings the widget's registry entry declares via
          `MenuActions`. */}
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
        <WidgetMenu instance={instance} def={def} onRemove={onRemove} />
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
        //
        // Only visible when the cursor hovers this widget (via the
        // `group` class on the parent <section>). The handle stays
        // functional and remains in the DOM regardless — Playwright's
        // `toBeVisible()` treats `opacity: 0` elements as visible,
        // and the pointer-events + resize gesture logic is unchanged.
        className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-se-resize border-r border-b border-emerald-500/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:border-emerald-300"
      />
    </section>
  );
}
