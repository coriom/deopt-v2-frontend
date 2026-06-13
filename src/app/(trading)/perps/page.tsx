import Link from "next/link";

export default function PerpsPage() {
  return (
    <div
      data-testid="perps-coming-soon"
      className="flex flex-col gap-5"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Perps
          </h1>
          <span
            data-testid="perps-status-chip"
            className="text-[10px] uppercase tracking-[0.18em] text-emerald-300"
          >
            coming later in the public testnet beta
          </span>
        </div>
        <p className="text-[11px] text-zinc-400">
          Public testnet beta on Base Sepolia (chain 84532) — no real funds.
          Perps are not live in this testnet beta yet. Current focus is options.
        </p>
      </header>

      <section
        data-testid="perps-disclosure-panel"
        className="rounded-lg border border-emerald-500/20 bg-zinc-950 p-5 text-sm text-zinc-300"
      >
        <h2 className="text-sm font-semibold tracking-tight text-emerald-200">
          What this page is
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-zinc-400">
          <li>Honest placeholder. No perps order ticket. No perps chain.</li>
          <li>No bid / ask / mark / IV / Greeks are shown for perps.</li>
          <li>No real funds. Unaudited. Experimental.</li>
          <li>This is not financial advice. Not a market-making invitation.</li>
        </ul>
      </section>

      <section
        data-testid="perps-meanwhile-panel"
        className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
      >
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          In the meantime
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link
            data-testid="perps-cta-options"
            href="/trade"
            className="rounded border border-emerald-500/40 px-3 py-2 text-center text-xs text-emerald-200 hover:bg-emerald-500/10"
          >
            Try the Options terminal
          </Link>
          <Link
            data-testid="perps-cta-markets"
            href="/markets"
            className="rounded border border-zinc-700 px-3 py-2 text-center text-xs text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Browse Markets
          </Link>
          <Link
            data-testid="perps-cta-docs"
            href="/docs"
            className="rounded border border-zinc-700 px-3 py-2 text-center text-xs text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Read the docs
          </Link>
          <Link
            data-testid="perps-cta-feedback"
            href="/feedback"
            className="rounded border border-zinc-700 px-3 py-2 text-center text-xs text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Send feedback
          </Link>
          <a
            data-testid="perps-cta-discord"
            href="https://discord.gg/zaEMvWuxu"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-zinc-700 px-3 py-2 text-center text-xs text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Open Discord
          </a>
        </div>
      </section>
    </div>
  );
}
