"use client";

export function CallPutToggle({
  value,
  onChange,
}: {
  value: boolean; // true = call
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded px-3 py-1 text-xs font-medium ${
          value ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400"
        }`}
      >
        Call
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded px-3 py-1 text-xs font-medium ${
          !value ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400"
        }`}
      >
        Put
      </button>
    </div>
  );
}
