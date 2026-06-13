"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { findPublicBetaLink, isPlaceholderHref } from "@/lib/public-beta-links";
import {
  buildBugContext,
  formatBugContextForCopy,
} from "@/lib/bug-report-context";

export interface ReportIssueButtonProps {
  /** Optional tx hash to include in the bug context. */
  txHash?: string | null;
  /** Optional intent id to include in the bug context. */
  intentId?: string | null;
  /** Visible button label. Defaults to "Report an issue". */
  label?: string;
  /** Visual variant for the button. */
  variant?: "primary" | "ghost" | "compact";
}

/**
 * Reusable bug-report button.
 *
 * Behaviour:
 *   - If the feedback URL is live, the button opens it in a new tab.
 *   - If the feedback URL is still a `{{TOKEN}}` placeholder, the button
 *     opens an inline panel offering to copy a redaction-safe bug
 *     context block. The tester can then paste that block wherever the
 *     operator eventually publishes the bug-report channel.
 *
 * Public-safe context fields: route, chain id, wallet public address,
 * tx hash (if any), intent id (if any), ISO timestamp, app version.
 * EXPLICITLY OMITS: private keys, seed phrases, RPC URLs, admin
 * bearer tokens, `.env` contents, DATABASE_URLs.
 */
export function ReportIssueButton({
  txHash = null,
  intentId = null,
  label = "Report an issue",
  variant = "ghost",
}: ReportIssueButtonProps) {
  const pathname = usePathname();
  const { address, chainId } = useWallet();
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const feedbackLink = findPublicBetaLink("feedback");
  const href = feedbackLink?.href ?? "";
  const isLive = href !== "" && !isPlaceholderHref(href);

  const ctx = buildBugContext({
    route: pathname ?? "(unknown)",
    chainId,
    address,
    txHash,
    intentId,
  });
  const ctxBlock = formatBugContextForCopy(ctx);

  const baseClass =
    variant === "primary"
      ? "rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      : variant === "compact"
        ? "rounded border border-zinc-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        : "rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

  if (isLive) {
    if (feedbackLink?.internal) {
      return (
        <Link
          href={href}
          data-testid="report-issue-link"
          data-target="internal"
          className={baseClass}
        >
          {label}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="report-issue-link"
        data-target="external"
        className={baseClass}
      >
        {label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        data-testid="report-issue-button"
        data-target="copy-context"
        className={baseClass}
      >
        {label}
      </button>
      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            data-testid="report-issue-panel"
            className="w-full max-w-lg rounded border border-zinc-300 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="text-sm font-semibold">
              Bug-report channel not yet live
            </div>
            <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
              The operator hasn&apos;t wired the public bug-report URL yet. In
              the meantime, copy the public-safe context block below and share
              it via whichever community channel becomes available. The
              context never includes private keys, seed phrases, RPC URLs, or
              admin tokens.
            </p>
            <pre
              data-testid="report-issue-context-block"
              className="mt-3 max-h-64 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[10px] leading-snug text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              {ctxBlock}
            </pre>
            <p className="mt-2 text-[10px] text-zinc-500">
              NEVER share your private key or seed phrase. NEVER share an RPC
              URL with an embedded API key. NEVER share a backend admin
              bearer token.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(ctxBlock);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    // clipboard may be unavailable in some browsers; the
                    // <pre> remains selectable for manual copy.
                  }
                }}
                data-testid="report-issue-copy-button"
                className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                {copied ? "Copied!" : "Copy context"}
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
