import Link from "next/link";
import { Workspace } from "@/components/workspace/Workspace";

export default function PerpsPage() {
  return (
    <div data-testid="perps-terminal-shell" className="flex flex-col gap-2">
      <Workspace
        workspaceId="perps"
        title="Perps workspace"
        subtitle="modular · v1 · placeholder"
      />

      <section
        data-testid="perps-disclosure-panel"
        className="rounded border border-emerald-500/30 bg-zinc-950 p-3 text-[11px] text-zinc-300"
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-emerald-300">
          <span>Disclosure</span>
          <span
            data-testid="perps-status-chip"
            className="text-zinc-500"
          >
            coming later in the public testnet beta
          </span>
        </div>
        <ul className="mt-2 ml-4 list-disc space-y-0.5 text-zinc-400">
          <li>Perps are not live in this testnet beta. No order ticket. No chain.</li>
          <li>No real bid / ask / mark / IV / funding / OI is shown.</li>
          <li>No real funds. Unaudited. Experimental.</li>
          <li>This is not financial advice. Not a market-making invitation.</li>
        </ul>
        <div
          data-testid="perps-meanwhile-panel"
          className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Link
            data-testid="perps-cta-options"
            href="/trade"
            className="rounded border border-emerald-500/40 px-3 py-2 text-center text-[11px] text-emerald-200 hover:bg-emerald-500/10"
          >
            Try Options
          </Link>
          <Link
            data-testid="perps-cta-docs"
            href="/docs"
            className="rounded border border-zinc-700 px-3 py-2 text-center text-[11px] text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Read the docs
          </Link>
          <a
            data-testid="perps-cta-discord"
            href="https://discord.gg/zaEMvWuxu"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-zinc-700 px-3 py-2 text-center text-[11px] text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Open Discord
          </a>
          <Link
            data-testid="perps-cta-feedback"
            href="/feedback"
            className="rounded border border-zinc-700 px-3 py-2 text-center text-[11px] text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Send feedback
          </Link>
        </div>
      </section>
    </div>
  );
}
