"use client";

// Reusable Time-In-Force popover (Derive-style). Renders a small
// `[ GTC ⌄ ]` pill which opens a dark menu listing each TIF with a
// one-line description and a check mark on the active option.
//
// The popover container carries `data-no-drag` so the WidgetFrame
// section-level drag handler does not initiate a widget drag when the
// user interacts with the menu's empty space.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Tif = "GTC" | "IOC" | "FOK";

interface TifOption {
  value: Tif;
  title: string;
  description: string;
}

const OPTIONS: TifOption[] = [
  {
    value: "GTC",
    title: "Good Til Cancel",
    description: "Order remains active until filled or cancelled",
  },
  {
    value: "FOK",
    title: "Fill Or Kill",
    description: "Order must fill completely immediately or cancel",
  },
  {
    value: "IOC",
    title: "Immediate Or Cancel",
    description: "Fill as much as possible immediately, cancel rest",
  },
];

export interface TifPopoverProps {
  value: Tif;
  onChange: (next: Tif) => void;
  /** Test-id prefix; defaults to `trade-tif`. */
  testid?: string;
}

export function TifPopover({ value, onChange, testid = "trade-tif" }: TifPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-no-drag
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`${testid}-trigger`}
        className="flex items-center gap-1 rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
      >
        <span>{value}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2 4 L5 7 L8 4"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Time in force"
          data-no-drag
          data-testid={`${testid}-menu`}
          className="absolute right-0 top-full z-30 mt-1 w-[240px] overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 shadow-lg shadow-black/60"
        >
          {OPTIONS.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                data-testid={`${testid}-option-${opt.value}`}
                className="flex w-full items-start gap-2 border-b border-zinc-900 px-3 py-2 text-left last:border-b-0 hover:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-zinc-100">
                    {opt.title}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug text-zinc-400">
                    {opt.description}
                  </div>
                </div>
                {selected ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    className="mt-0.5 shrink-0 text-emerald-300"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 7 L6 10 L11 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export interface PostCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  testid?: string;
}

/** Compact "Post" (post-only) checkbox matching the Derive trade-ticket style. */
export function PostCheckbox({ checked, onChange, testid = "trade-post" }: PostCheckboxProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  // Portal-based tooltip: rendered directly under <body> so it always
  // paints above every widget (each widget frame owns its stacking
  // context, and their body divs use `overflow-auto` which would
  // otherwise clip any absolute tooltip inside them). Tooltip state
  // is only ever set from a pointer handler — SSR always sees `null`,
  // so `document.body` is only accessed on the client.
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const showTooltip = () => {
    if (!textRef.current) return;
    const rect = textRef.current.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top });
  };
  const hideTooltip = () => setTooltip(null);

  return (
    <label
      data-no-drag
      className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[11px] text-zinc-300 hover:text-emerald-200"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={`${testid}-checkbox`}
        className="h-3 w-3 cursor-pointer accent-emerald-500"
      />
      <span
        ref={textRef}
        onPointerEnter={showTooltip}
        onPointerLeave={hideTooltip}
      >
        Post
      </span>
      {tooltip
        ? createPortal(
            <span
              data-testid={`${testid}-tooltip`}
              role="tooltip"
              style={{
                position: "fixed",
                left: tooltip.x,
                top: tooltip.y - 4,
                transform: "translate(-50%, -100%)",
              }}
              className="pointer-events-none z-[9999] whitespace-nowrap rounded border border-zinc-700/70 bg-zinc-950/70 px-2 py-1 text-[10px] font-medium text-zinc-100 shadow-lg backdrop-blur-sm"
            >
              Always performed as a maker
            </span>,
            document.body,
          )
        : null}
    </label>
  );
}
