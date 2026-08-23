import type { ReactNode } from "react";

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  /** Test id for the whole row wrapper. */
  testid?: string;
  /** When true the row is wrapped in a native `<label>` so clicking
   *  the label text focuses the enclosed control (implicit form
   *  association — no `htmlFor` / id juggling required). Set to false
   *  for rows whose control isn't a single form input. */
  asLabel?: boolean;
}

/** One row inside a Settings card: label + optional subtitle on the
 *  left, control on the right, thin separator below (removed on the
 *  last row by `last:border-b-0`). */
export function SettingRow({
  label,
  description,
  children,
  testid,
  asLabel = true,
}: SettingRowProps) {
  const className =
    "flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0 border-b border-zinc-900 last:border-b-0";
  const inner = (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-zinc-100">{label}</span>
        {description ? (
          <span className="text-[11px] text-zinc-500">{description}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </>
  );
  return asLabel ? (
    <label data-testid={testid} className={className}>
      {inner}
    </label>
  ) : (
    <div data-testid={testid} className={className}>
      {inner}
    </div>
  );
}
