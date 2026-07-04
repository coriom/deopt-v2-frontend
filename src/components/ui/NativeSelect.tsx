"use client";

// Small skinned wrapper around a native `<select>` element.
//
// We keep the native element under the hood so:
//   - Playwright `.selectOption(value)` still works — a custom listbox
//     would require every spec to be rewritten.
//   - Keyboard navigation + a11y live event trees are free.
//   - Mobile OS pickers still fire on tap.
//
// The visual treatment strips the browser chrome (`appearance-none`)
// and paints a consistent zinc/emerald caret via inline SVG on the
// right edge. Two variants match the two call sites currently in use:
//
//   - `bordered` — pill with a subtle border, hover in emerald.
//   - `ghost`    — transparent, uppercase, used for the underlying
//                   selector in the Options terminal banner.

import { forwardRef, type SelectHTMLAttributes } from "react";

export type NativeSelectVariant = "bordered" | "ghost";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: NativeSelectVariant;
}

const CONTAINER_CLASSES = "relative inline-flex items-center";

const SELECT_CLASSES_BY_VARIANT: Record<NativeSelectVariant, string> = {
  bordered:
    // Pill with soft border, dark bg, subtle emerald hover state.
    "appearance-none cursor-pointer rounded border border-zinc-800 bg-black/40 pl-2.5 pr-6 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:border-emerald-500/50 hover:text-zinc-100 focus:border-emerald-500/60 focus:outline-none",
  ghost:
    // No border, transparent bg. Suited for use inline in a header.
    "appearance-none cursor-pointer rounded bg-transparent pl-0 pr-5 py-0.5 text-[12px] font-semibold uppercase tracking-wider text-zinc-100 transition-colors hover:text-emerald-300 focus:outline-none",
};

const CARET_OFFSET_BY_VARIANT: Record<NativeSelectVariant, string> = {
  bordered: "right-2",
  ghost: "right-0",
};

export const NativeSelect = forwardRef<HTMLSelectElement, Props>(
  function NativeSelect(
    { variant = "bordered", className, children, ...rest },
    ref,
  ) {
    const selectClass = SELECT_CLASSES_BY_VARIANT[variant];
    return (
      <span className={CONTAINER_CLASSES}>
        <select
          ref={ref}
          className={`${selectClass}${className ? ` ${className}` : ""}`}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          width="10"
          height="6"
          className={`pointer-events-none absolute ${CARET_OFFSET_BY_VARIANT[variant]} text-zinc-400`}
        >
          <path
            d="M1 1 L5 5 L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  },
);
