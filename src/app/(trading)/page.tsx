import Link from "next/link";
import { MarketSelector } from "@/components/trading/MarketSelector";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { findPublicBetaLink, isPlaceholderHref } from "@/lib/public-beta-links";

function CtaButton({
  id,
  label,
  variant = "primary",
}: {
  id: string;
  label: string;
  variant?: "primary" | "ghost";
}) {
  const link = findPublicBetaLink(id);
  const href = link?.href ?? "";
  const isLive = href !== "" && !isPlaceholderHref(href);
  const base =
    variant === "primary"
      ? "rounded bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400"
      : "rounded border border-emerald-500/40 px-4 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10";
  if (isLive) {
    if (link?.internal) {
      return (
        <Link
          href={href}
          data-testid={`landing-cta-${id}`}
          data-target="internal"
          className={base}
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
        data-testid={`landing-cta-${id}`}
        data-target="external"
        className={base}
      >
        {label}
      </a>
    );
  }
  return (
    <span
      data-testid={`landing-cta-${id}`}
      data-target="placeholder"
      title={`${label} link not yet configured by the operator`}
      className={`cursor-not-allowed opacity-60 ${base}`}
    >
      {label} (coming soon)
    </span>
  );
}

export default function TradingLanding() {
  return (
    <div className="flex flex-col gap-8">
      <section
        data-testid="landing-intro"
        className="relative overflow-hidden rounded-lg border border-emerald-500/30 bg-zinc-950 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.05)]"
      >
        {/* Subtle deep-green corner glow — no animation, no extra deps. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4">
          <span
            data-testid="landing-public-beta-pill"
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Public testnet beta — unaudited — experimental
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            On-chain options. <span className="text-emerald-400">Base Sepolia.</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">
            DeOpt V2 settles two-sided EIP-712 option trades on chain via an
            operator-side executor. This build is a community preview for
            testing and feedback — no real funds, no audit, no mainnet, no
            SLA. Mainnet is permanently disabled in this build.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/markets"
              data-testid="landing-cta-start-testing"
              className="rounded bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400"
            >
              Start testing
            </Link>
            <CtaButton id="quickstart" label="Read the quickstart" variant="ghost" />
            <ReportIssueButton label="Report feedback" variant="ghost" />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="markets-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-baseline justify-between">
          <h2
            id="markets-heading"
            className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200"
          >
            Browse markets
          </h2>
          <span className="text-[10px] text-zinc-500">
            Base Sepolia (chain 84532) · testnet only
          </span>
        </div>
        <MarketSelector />
      </section>
    </div>
  );
}
