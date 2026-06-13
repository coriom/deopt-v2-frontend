"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PUBLIC_BETA_LINKS,
  isPlaceholderHref,
} from "@/lib/public-beta-links";

interface Entry {
  id: string;
  label: string;
  href: string;
  internal: boolean;
  description?: string;
}

function entriesFromConfig(): Entry[] {
  const wanted = ["quickstart", "feedback", "discord", "github", "limitations"];
  const out: Entry[] = [];
  for (const id of wanted) {
    const l = PUBLIC_BETA_LINKS.find((x) => x.id === id);
    if (!l) continue;
    out.push({
      id: l.id,
      label: l.label,
      href: l.href,
      internal: !!l.internal,
      description: l.description,
    });
  }
  return out;
}

/**
 * Slide-out hamburger drawer for the trading-terminal navbar.
 *
 * Contains: Docs index, Quickstart, Feedback, Discord, GitHub, Risks /
 * limitations, Changelog placeholder. NO admin links — admin paths
 * are operator-only and gated by separate auth elsewhere.
 *
 * Posture: testnet only. Internal-route entries use Next.js <Link>;
 * external entries open in a new tab. Placeholder slots degrade to a
 * non-clickable "(coming soon)" row.
 */
export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const entries = entriesFromConfig();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="hamburger-button"
        className="flex h-7 w-7 items-center justify-center rounded border border-zinc-800 text-zinc-300 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-200"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="2" y1="4" x2="12" y2="4" />
          <line x1="2" y1="7" x2="12" y2="7" />
          <line x1="2" y1="10" x2="12" y2="10" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          data-testid="hamburger-drawer"
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-72 max-w-[90vw] flex-col gap-3 border-l border-emerald-500/30 bg-zinc-950 p-5 text-zinc-100 shadow-[0_0_30px_rgba(16,185,129,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                data-testid="hamburger-close-button"
                className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
              >
                ✕
              </button>
            </div>

            <nav aria-label="Hamburger menu" className="flex flex-col gap-1">
              <DrawerLink href="/docs" label="Docs" testid="hamburger-link-docs-index" onPick={() => setOpen(false)} />
              {entries.map((e) =>
                isPlaceholderHref(e.href) ? (
                  <span
                    key={e.id}
                    data-testid={`hamburger-link-${e.id}`}
                    data-placeholder="true"
                    className="cursor-not-allowed rounded px-2 py-1.5 text-[12px] text-zinc-500"
                  >
                    {e.label} (coming soon)
                  </span>
                ) : e.internal ? (
                  <Link
                    key={e.id}
                    href={e.href}
                    data-testid={`hamburger-link-${e.id}`}
                    data-target="internal"
                    onClick={() => setOpen(false)}
                    className="rounded px-2 py-1.5 text-[12px] text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                  >
                    {e.label}
                  </Link>
                ) : (
                  <a
                    key={e.id}
                    href={e.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`hamburger-link-${e.id}`}
                    data-target="external"
                    onClick={() => setOpen(false)}
                    className="rounded px-2 py-1.5 text-[12px] text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                  >
                    {e.label}
                  </a>
                ),
              )}
              <span
                data-testid="hamburger-link-changelog"
                data-placeholder="true"
                className="cursor-not-allowed rounded px-2 py-1.5 text-[12px] text-zinc-500"
                title="Changelog will be published once the public testnet beta cycle begins generating one"
              >
                Changelog (coming soon)
              </span>
            </nav>

            <div className="mt-auto rounded border border-zinc-800 bg-black/40 p-2 text-[10px] leading-relaxed text-zinc-400">
              Public testnet beta — Base Sepolia only. Unaudited.
              Experimental. No real funds.
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function DrawerLink({
  href,
  label,
  testid,
  onPick,
}: {
  href: string;
  label: string;
  testid: string;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      data-target="internal"
      onClick={onPick}
      className="rounded px-2 py-1.5 text-[12px] text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
    >
      {label}
    </Link>
  );
}
