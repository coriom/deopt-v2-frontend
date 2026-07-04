"use client";

interface ExpirySelectorProps {
  expiries: Array<{ ms: number; label: string }>;
  selected: number | null;
  onSelect: (ms: number | null) => void;
}

export function ExpirySelector({
  expiries,
  selected,
  onSelect,
}: ExpirySelectorProps) {
  if (expiries.length === 0) {
    return (
      <div
        data-testid="expiry-selector-empty"
        className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-500"
      >
        No expiries available — testnet warm-up.
      </div>
    );
  }
  return (
    <div
      data-testid="expiry-selector"
      role="tablist"
      aria-label="Expiry"
      className="flex flex-wrap gap-2"
    >
      {expiries.map((e) => (
        <button
          key={e.ms}
          type="button"
          role="tab"
          aria-selected={selected === e.ms}
          onClick={() => onSelect(e.ms)}
          data-testid={`expiry-pill-${e.ms}`}
          data-selected={selected === e.ms ? "true" : "false"}
          className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
            selected === e.ms
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
              : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40"
          }`}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}
