import Link from "next/link";

export const metadata = {
  title: "Fees — DeOpt public testnet beta",
};

export default function FeesPage() {
  return (
    <div className="flex flex-col gap-6" data-testid="fees-page">
      <header className="flex flex-col gap-2">
        <span
          data-testid="fees-page-status-chip"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Public testnet beta · Base Sepolia · unaudited
        </span>
        <h1 className="text-xl font-semibold text-zinc-100">Fees</h1>
        <p
          data-testid="fees-page-summary"
          className="text-sm text-zinc-400"
        >
          Fee documentation is being prepared for the public testnet beta. The
          numbers below are placeholders only; nothing here is final, nothing
          here is mainnet-ready, and nothing here implies safety for real
          funds.
        </p>
      </header>

      <section
        data-testid="fees-page-disclaimers"
        className="rounded-lg border border-emerald-500/30 bg-zinc-950 p-4 text-[12px] text-zinc-300"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          What you can rely on right now
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
          <li>
            Every trade in this beta is on Base Sepolia testnet only. Mock
            tokens, no real funds.
          </li>
          <li>
            Any displayed fee is testnet-only and subject to change before any
            possible future mainnet release.
          </li>
          <li>
            There is no live fee schedule, no rebate program, and no maker /
            taker tier in this build.
          </li>
        </ul>
      </section>

      <section
        data-testid="fees-page-roadmap"
        className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[12px] text-zinc-300"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          What lands later
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
          <li>Detailed protocol fee schedule per product type.</li>
          <li>Settlement / network fee breakdown per chain.</li>
          <li>Rebate policy once the maker side ships.</li>
        </ul>
      </section>

      <section
        data-testid="fees-page-links"
        className="grid gap-3 sm:grid-cols-3"
      >
        <Link
          href="/docs"
          data-testid="fees-page-link-docs"
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Docs
          </span>
          <span className="block">Public testnet beta documentation index.</span>
        </Link>
        <Link
          href="/feedback"
          data-testid="fees-page-link-feedback"
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Feedback
          </span>
          <span className="block">Report a bug or open a question.</span>
        </Link>
        <a
          href="https://discord.gg/zaEMvWuxu"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="fees-page-link-discord"
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
