"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DrawerEntry {
  id: string;
  label: string;
  href: string;
  /** Internal Next.js route → render as <Link>. External URL → <a target="_blank">. */
  internal: boolean;
}

interface DrawerSection {
  id: string;
  title: string;
  entries: DrawerEntry[];
}

/**
 * Slide-out hamburger drawer for the trading-terminal navbar.
 *
 * V2 (FRONTEND-NAVBAR-HAMBURGER-IA-CLEANUP, 2026-06-14):
 *   - Portfolio + API moved out of the primary navbar and into this menu
 *   - New /fees + /api placeholder routes wired up
 *   - Sections: Pages / Docs / Community
 *   - Includes: Docs · Quickstart · Fees · API · Portfolio · Feedback ·
 *     Discord · GitHub · Known limitations · FAQ
 *
 * Posture: testnet only. Internal-route entries use Next.js <Link>;
 * external entries open in a new tab. NO admin links — admin paths
 * are operator-only and gated by separate auth elsewhere.
 */
const SECTIONS: DrawerSection[] = [
  {
    id: "pages",
    title: "Pages",
    entries: [
      { id: "portfolio", label: "Portfolio", href: "/portfolio", internal: true },
      { id: "fees", label: "Fees", href: "/fees", internal: true },
      { id: "api", label: "API", href: "/api", internal: true },
      { id: "feedback", label: "Feedback", href: "/feedback", internal: true },
    ],
  },
  {
    id: "docs",
    title: "Docs",
    entries: [
      { id: "docs-index", label: "Docs", href: "/docs", internal: true },
      { id: "quickstart", label: "Quickstart", href: "/docs/quickstart", internal: true },
      { id: "limitations", label: "Known limitations", href: "/docs/limitations", internal: true },
      { id: "faq", label: "FAQ", href: "/docs/faq", internal: true },
    ],
  },
  {
    id: "community",
    title: "Community",
    entries: [
      { id: "discord", label: "Discord", href: "https://discord.gg/zaEMvWuxu", internal: false },
      { id: "github", label: "GitHub", href: "https://github.com/DeOpt", internal: false },
    ],
  },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);

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
            className="flex h-full w-72 max-w-[90vw] flex-col gap-3 overflow-y-auto border-l border-emerald-500/30 bg-zinc-950 p-5 text-zinc-100 shadow-[0_0_30px_rgba(16,185,129,0.08)]"
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

            <nav aria-label="Hamburger menu" className="flex flex-col gap-3">
              {SECTIONS.map((section) => (
                <div
                  key={section.id}
                  data-testid={`hamburger-section-${section.id}`}
                  className="flex flex-col gap-1"
                >
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {section.title}
                  </span>
                  {section.entries.map((e) =>
                    e.internal ? (
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
                </div>
              ))}
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
