"use client";

import { useState } from "react";
import type { WidgetInstance, WidgetSize } from "@/lib/workspace-types";
import type { WidgetDef } from "./registry";

const SIZE_TO_COL: Record<WidgetSize, string> = {
  sm: "col-span-12 md:col-span-3",
  md: "col-span-12 md:col-span-6 lg:col-span-4",
  lg: "col-span-12 lg:col-span-6",
  xl: "col-span-12",
};

const SIZE_LABEL: Record<WidgetSize, string> = {
  sm: "S",
  md: "M",
  lg: "L",
  xl: "Full",
};

interface WidgetFrameProps {
  instance: WidgetInstance;
  def: WidgetDef;
  onRemove: () => void;
  onResize: (size: WidgetSize) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function WidgetFrame({
  instance,
  def,
  onRemove,
  onResize,
  onMoveUp,
  onMoveDown,
}: WidgetFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Render = def.Render;
  return (
    <section
      data-testid={`widget-${instance.type}`}
      data-widget-id={instance.id}
      data-widget-size={instance.size}
      data-widget-implemented={def.implemented ? "true" : "false"}
      aria-label={def.title}
      className={`flex flex-col gap-1 rounded border border-zinc-800 bg-zinc-950 p-2 ${SIZE_TO_COL[instance.size]}`}
    >
      <header className="flex items-center justify-between gap-2">
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
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            data-testid={`widget-move-up-${instance.id}`}
            aria-label="Move widget up"
            className="rounded border border-transparent px-1 text-[10px] text-zinc-500 hover:border-zinc-700 hover:text-emerald-200"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            data-testid={`widget-move-down-${instance.id}`}
            aria-label="Move widget down"
            className="rounded border border-transparent px-1 text-[10px] text-zinc-500 hover:border-zinc-700 hover:text-emerald-200"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            data-testid={`widget-size-toggle-${instance.id}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="rounded border border-zinc-800 px-1.5 text-[10px] text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            {SIZE_LABEL[instance.size]} ▾
          </button>
          {menuOpen ? (
            <div
              role="menu"
              data-testid={`widget-size-menu-${instance.id}`}
              className="absolute right-0 top-5 z-10 flex flex-col gap-0.5 rounded border border-zinc-800 bg-zinc-950 p-1"
            >
              {(["sm", "md", "lg", "xl"] as WidgetSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  data-testid={`widget-size-${s}-${instance.id}`}
                  onClick={() => {
                    onResize(s);
                    setMenuOpen(false);
                  }}
                  className={`rounded px-2 py-0.5 text-left text-[10px] ${
                    instance.size === s
                      ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "text-zinc-300 hover:bg-emerald-500/5 hover:text-emerald-200"
                  }`}
                >
                  {SIZE_LABEL[s]}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            data-testid={`widget-remove-${instance.id}`}
            aria-label="Remove widget"
            className="rounded border border-transparent px-1 text-[10px] text-zinc-500 hover:border-zinc-700 hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
      </header>
      <div data-testid={`widget-body-${instance.type}`}>
        <Render />
      </div>
    </section>
  );
}
