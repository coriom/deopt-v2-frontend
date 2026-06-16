import Link from "next/link";
import type { ReactNode } from "react";

interface PlaceholderPageProps {
  testid: string;
  title: string;
  summary: ReactNode;
  /** "What you can rely on right now" bullets. */
  reliableNow: ReactNode[];
  /** "What lands later" bullets. */
  landsLater: ReactNode[];
}

/**
 * Shared scaffold for the testnet-beta "coming soon" surfaces
 * (/rfq-strategy, /leaderboard, /fundings, /settings, etc.). Mirrors
 * the look-and-feel of the existing /fees and /api placeholder pages
 * so the IA stays consistent.
 *
 * Posture: honest testnet beta — no live claims, no mainnet hints, no
 * external API calls, no positive-claim language.
 */
export function PlaceholderPage({
  testid,
  title,
  summary,
  reliableNow,
  landsLater,
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-6" data-testid={testid}>
      <header className="flex flex-col gap-2">
        <span
          data-testid={`${testid}-status-chip`}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Public testnet beta · Base Sepolia · unaudited
        </span>
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        <p data-testid={`${testid}-summary`} className="text-sm text-zinc-400">
          {summary}
        </p>
      </header>

      <section
        data-testid={`${testid}-reliable-now`}
        className="rounded-lg border border-emerald-500/30 bg-zinc-950 p-4 text-[12px] text-zinc-300"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          What you can rely on right now
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
          {reliableNow.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section
        data-testid={`${testid}-lands-later`}
        className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[12px] text-zinc-300"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          What lands later
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
          {landsLater.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section
        data-testid={`${testid}-links`}
        className="grid gap-3 sm:grid-cols-3"
      >
        <Link
          href="/docs"
          data-testid={`${testid}-link-docs`}
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Docs
          </span>
          <span className="block">Public testnet beta documentation index.</span>
        </Link>
        <Link
          href="/feedback"
          data-testid={`${testid}-link-feedback`}
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Support
          </span>
          <span className="block">Report a bug or open a question.</span>
        </Link>
        <a
          href="https://discord.gg/zaEMvWuxu"
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`${testid}-link-discord`}
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Discord
          </span>
          <span className="block">Ask the operator and other testers.</span>
        </a>
      </section>
    </div>
  );
}
