"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DRAWER_ANIM_MS = 180;

interface DrawerEntry {
  id: string;
  label: string;
  href: string;
  internal: boolean;
}

/**
 * Slide-out hamburger drawer for the trading-terminal navbar.
 *
 * V3 (FRONTEND-NAVBAR-IA-V1, 2026-06-16):
 *   - Drawer now opens from the LEFT (was: right) and anchors under the
 *     left side of the navbar, where the hamburger button now lives.
 *   - Items are a single ordered list (no Pages / Docs / Community
 *     sections) matching the navbar IA brief exactly.
 *   - Discord + GitHub demoted to a small secondary "Community" row at
 *     the bottom — visually distinct so they do not compete with the
 *     primary 13-item order.
 *   - Portfolio is no longer surfaced from the hamburger; the
 *     `/portfolio` route still works for direct URLs.
 */
const PRIMARY_ITEMS: DrawerEntry[] = [
  { id: "options",       label: "Options",         href: "/trade",         internal: true },
  { id: "perps",         label: "Perps",           href: "/perps",         internal: true },
  { id: "markets",       label: "Markets",         href: "/markets",       internal: true },
  { id: "rfq-strategy",  label: "RFQ/Strategy",    href: "/rfq-strategy",  internal: true },
  { id: "custom",        label: "Custom",          href: "/custom",        internal: true },
  { id: "academy",       label: "DeOpt Academy",   href: "/docs",          internal: true },
  { id: "history",       label: "History",         href: "/history",       internal: true },
  { id: "leaderboard",   label: "Leaderboard",     href: "/leaderboard",   internal: true },
  { id: "api",           label: "API",             href: "/api",           internal: true },
  { id: "fees",          label: "Fees",            href: "/fees",          internal: true },
  { id: "fundings",      label: "Fundings",        href: "/fundings",      internal: true },
  { id: "settings",      label: "Settings",        href: "/settings",      internal: true },
  { id: "support",       label: "Support",         href: "/feedback",      internal: true },
];

const SECONDARY_ITEMS: DrawerEntry[] = [
  { id: "discord", label: "Discord", href: "https://discord.gg/zaEMvWuxu", internal: false },
  { id: "github",  label: "GitHub",  href: "https://github.com/DeOpt",     internal: false },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  // `exiting` keeps the drawer in the DOM through the close animation
  // window; `mounted` is derived so we never call setState directly
  // inside an effect to flip a presence flag.
  const [exiting, setExiting] = useState(false);
  const [topOffset, setTopOffset] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();

  const mounted = open || exiting;

  const openDrawer = () => {
    setOpen(true);
    // Cancel any pending exit so the user can re-open mid-animation
    // without waiting for the timer.
    setExiting(false);
  };
  const closeDrawer = () => {
    setOpen(false);
    setExiting(true);
  };

  // When the user closes the drawer, keep it mounted until the exit
  // animation finishes. The setTimeout callback fires asynchronously,
  // so this effect body never calls setState synchronously.
  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(() => setExiting(false), DRAWER_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [exiting]);

  // Anchor the drawer below the navbar header so it never overlaps the
  // top bar. We walk up from the hamburger button to its nearest
  // <header> and use that element's bottom edge as the drawer's top.
  useEffect(() => {
    if (!mounted) return;
    function measure() {
      const btn = buttonRef.current;
      if (!btn) return;
      const header = btn.closest("header");
      if (header) {
        const r = header.getBoundingClientRect();
        setTopOffset(Math.max(0, Math.round(r.bottom)));
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openDrawer}
        onMouseEnter={openDrawer}
        onFocus={openDrawer}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="hamburger-button"
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-300 hover:bg-emerald-500/5 hover:text-emerald-200"
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
      {mounted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          aria-hidden={open ? undefined : true}
          data-testid="hamburger-drawer"
          data-drawer-side="left"
          data-drawer-state={open ? "open" : "closing"}
          className={`${
            open ? "deopt-drawer-backdrop-enter" : "deopt-drawer-backdrop-exit"
          } fixed inset-x-0 bottom-0 z-50 flex justify-start bg-black/60`}
          style={{ top: `${topOffset}px` }}
          onClick={closeDrawer}
        >
          <aside
            data-testid="hamburger-drawer-panel"
            className={`${
              open ? "deopt-drawer-panel-enter" : "deopt-drawer-panel-exit"
            } flex h-full w-72 max-w-[90vw] flex-col gap-3 overflow-y-auto border-r border-emerald-500/30 bg-zinc-950 p-5 text-zinc-100 shadow-[0_0_30px_rgba(16,185,129,0.08)]`}
            onClick={(e) => e.stopPropagation()}
            onMouseLeave={closeDrawer}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Menu
              </span>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close menu"
                data-testid="hamburger-close-button"
                className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
              >
                ✕
              </button>
            </div>

            <nav
              aria-label="Hamburger menu"
              data-testid="hamburger-primary-list"
              className="flex flex-col"
            >
              {PRIMARY_ITEMS.map((e) => {
                const active = isActive(pathname, e.href);
                return (
                  <Link
                    key={e.id}
                    href={e.href}
                    data-testid={`hamburger-link-${e.id}`}
                    data-target="internal"
                    data-active={active ? "true" : "false"}
                    aria-current={active ? "page" : undefined}
                    onClick={closeDrawer}
                    className={
                      active
                        ? "rounded bg-emerald-500/10 px-2 py-1.5 text-[13px] text-emerald-300"
                        : "rounded px-2 py-1.5 text-[13px] text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                    }
                  >
                    {e.label}
                  </Link>
                );
              })}
            </nav>

            <div
              data-testid="hamburger-secondary-list"
              className="mt-auto flex items-center gap-2 border-t border-zinc-800 pt-3"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Community
              </span>
              {SECONDARY_ITEMS.map((e) => (
                <a
                  key={e.id}
                  href={e.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`hamburger-link-${e.id}`}
                  data-target="external"
                  onClick={closeDrawer}
                  className="rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
                >
                  {e.label}
                </a>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
