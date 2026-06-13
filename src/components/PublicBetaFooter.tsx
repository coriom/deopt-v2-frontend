"use client";

import Link from "next/link";
import {
  PUBLIC_BETA_LINKS,
  isPlaceholderHref,
} from "@/lib/public-beta-links";

/**
 * Public testnet beta footer. Renders the safety-copy block + the
 * public docs / feedback links. Placeholder hrefs are rendered as
 * non-clickable text so users see the slot exists but cannot click a
 * dead link before the operator wires it up.
 *
 * Internal-route slots (e.g. `/docs/quickstart`, `/feedback`) render
 * as Next.js <Link> for client-side navigation. External URLs render
 * as `<a target="_blank">`.
 *
 * Posture: testnet only, unaudited. NO secrets, NO admin bearer, NO
 * RPC URLs, NO DATABASE_URLs.
 */
export function PublicBetaFooter() {
  return (
    <footer
      data-testid="public-beta-footer"
      className="mt-12 border-t border-emerald-500/20 bg-zinc-950 px-4 py-6 text-xs text-zinc-300"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Public testnet beta — UNAUDITED — experimental
          </div>
          <ul className="ml-4 list-disc text-[11px] text-zinc-400">
            <li>Base Sepolia (chain 84532) only. Mainnet is disabled.</li>
            <li>No real funds. All tokens are testnet mocks.</li>
            <li>No audit, no bug bounty, no SLA.</li>
            <li>Addresses, APIs, and behaviour may change without notice.</li>
            <li>NEVER share your private key or seed phrase with anyone.</li>
          </ul>
        </div>
        <nav
          aria-label="Public beta documentation"
          className="flex flex-wrap gap-x-4 gap-y-2 text-[11px]"
        >
          {PUBLIC_BETA_LINKS.map((link) => {
            const placeholder = isPlaceholderHref(link.href);
            const linkClass =
              "text-emerald-200 underline decoration-emerald-500/40 underline-offset-4 hover:text-emerald-100 hover:decoration-emerald-400";
            if (placeholder) {
              return (
                <span
                  key={link.id}
                  data-testid={`public-beta-link-${link.id}`}
                  data-placeholder="true"
                  title={`${link.description} (link not yet configured)`}
                  className="cursor-not-allowed text-zinc-500 underline decoration-dashed underline-offset-4"
                >
                  {link.label} (coming soon)
                </span>
              );
            }
            if (link.internal) {
              return (
                <Link
                  key={link.id}
                  data-testid={`public-beta-link-${link.id}`}
                  data-target="internal"
                  href={link.href}
                  title={link.description}
                  className={linkClass}
                >
                  {link.label}
                </Link>
              );
            }
            return (
              <a
                key={link.id}
                data-testid={`public-beta-link-${link.id}`}
                data-target="external"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                title={link.description}
                className={linkClass}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
