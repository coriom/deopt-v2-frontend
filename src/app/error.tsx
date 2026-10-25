"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportClientError("react", error, "react-segment"), [error]);
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-zinc-100">
      <h1 className="text-xl font-semibold">This view could not load</h1>
      <p className="mt-3 text-sm text-zinc-400">
        Check any pending action before trying this view again.
      </p>
      <button type="button" onClick={reset} className="mt-6 rounded border border-zinc-600 px-4 py-2">
        Try again
      </button>
    </main>
  );
}
