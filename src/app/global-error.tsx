"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportClientError("react", error, "react-root"), [error]);
  return (
    <html lang="en">
      <body className="bg-black text-zinc-100">
        <main className="mx-auto max-w-xl px-6 py-24">
          <h1 className="text-xl font-semibold">DeOpt could not load</h1>
          <p className="mt-3 text-sm text-zinc-400">Try again to recover this view.</p>
          <button type="button" onClick={reset} className="mt-6 rounded border border-zinc-600 px-4 py-2">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
