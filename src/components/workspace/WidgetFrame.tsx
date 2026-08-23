"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { WidgetInstance } from "@/lib/workspace-types";
import type { WidgetDef } from "./registry";
import { WidgetMenu } from "./WidgetMenu";

/** Height of the top "header strip" that acts as the drag handle.
 *  Only pointer-downs inside this vertical band initiate a widget
 *  drag — clicks in the body region below never start a move gesture,
 *  even if they land on empty space. Matches the natural top row where
 *  every widget already renders its title / controls / kebab. */
const DRAG_HEADER_PX = 32;

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
  // A drag only starts when:
  //   1. The pointer lands inside the top header strip (Y ≤ DRAG_HEADER_PX
  //      from the section's top edge) — everything below is a no-drag zone,
  //      so users cannot inadvertently move a widget by clicking empty body
  //      space.
  //   2. The event target is not an interactive control — otherwise
  //      beginDrag's preventDefault() would swallow clicks on buttons,
  //      dropdowns, tabs, etc. that widgets render in their header.
  const handleSectionPointerDown = (e: ReactPointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const localY = e.clientY - rect.top;
    if (localY > DRAG_HEADER_PX) return;

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
  // Cursor affordance: hovering the top header strip swaps the section
  // cursor to `grab` (hand), so users see the drag zone without any
  // visual chrome. We mutate the style imperatively — a React state
  // toggle on every pointermove would trigger unnecessary re-renders
  // of the whole widget subtree. Interactive descendants (buttons,
  // dropdowns, kebab, resize handle) keep their own cursor because
  // they are the actual pointerover target inside their bounds.
  const handleSectionPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const inHeader = e.clientY - rect.top <= DRAG_HEADER_PX;
    e.currentTarget.style.cursor = inHeader ? "grab" : "";
  };
  return (
    <section
      data-testid={`widget-${instance.type}`}
      data-widget-id={instance.id}
      data-widget-implemented={def.implemented ? "true" : "false"}
      aria-label={def.title}
      title={def.title}
      onPointerDown={handleSectionPointerDown}
      onPointerMove={handleSectionPointerMove}
      className="group relative flex h-full w-full flex-col rounded border border-zinc-900 bg-zinc-950 select-none"
    >
      {/* Header strip = drag handle. pointer-events-none so widget-
          owned controls at the top of the body (title pills, symbol
          dropdown, tabs, kebab, ...) keep working — the strip only
          provides the `cursor: move` affordance over any empty space
          in that band. Its height matches DRAG_HEADER_PX above so the
          visual affordance and the drag hit-test stay in sync. */}
      <span
        data-testid={`widget-drag-handle-${instance.id}`}
        aria-hidden
        style={{ height: DRAG_HEADER_PX }}
        className="pointer-events-none absolute top-0 right-0 left-0 z-0 cursor-move"
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
