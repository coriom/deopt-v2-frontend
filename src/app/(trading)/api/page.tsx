import Link from "next/link";

export const metadata = {
  title: "API — DeOpt public testnet beta",
};

export default function ApiPage() {
  return (
    <div className="flex flex-col gap-6" data-testid="api-page">
      <header className="flex flex-col gap-2">
        <span
          data-testid="api-page-status-chip"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Public testnet beta · Base Sepolia · unaudited
        </span>
        <h1 className="text-xl font-semibold text-zinc-100">API</h1>
        <p data-testid="api-page-summary" className="text-sm text-zinc-400">
          The public testnet API surface is still being prepared. Endpoints
          listed below are testnet-only, may change without notice, and are
          not safe to rely on for any production integration.
        </p>
      </header>

      <section
        data-testid="api-page-disclaimers"
        className="rounded-lg border border-emerald-500/30 bg-zinc-950 p-4 text-[12px] text-zinc-300"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          What you can rely on right now
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
          <li>
            The public testnet read-side exposes:{" "}
            <code className="rounded border border-zinc-800 bg-black/40 px-1 text-emerald-200">
              /health
            </code>{" "}
            ,{" "}
            <code className="rounded border border-zinc-800 bg-black/40 px-1 text-emerald-200">
              /options/products
            </code>{" "}
            ,{" "}
            <code className="rounded border border-zinc-800 bg-black/40 px-1 text-emerald-200">
              /markets
            </code>
            . Every value is testnet (chain id 84532).
          </li>
          <li>
            There is no public write API. Trades are submitted through the
            connected wallet via standard intent / signature flow inside the
            terminal.
          </li>
          <li>
            No admin endpoints are part of the public surface. Operator
            tooling stays behind separate auth on private hosts.
          </li>
        </ul>
      </section>

      <section
        data-testid="api-page-roadmap"
        className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[12px] text-zinc-300"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          What lands later
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-400">
          <li>OpenAPI reference for every public testnet endpoint.</li>
          <li>Stable URL schema and versioning policy.</li>
          <li>
            Rate-limit + auth guidance once the maker / programmatic surface
            ships.
          </li>
        </ul>
      </section>

      <section
        data-testid="api-page-links"
        className="grid gap-3 sm:grid-cols-3"
      >
        <Link
          href="/docs"
          data-testid="api-page-link-docs"
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Docs
          </span>
          <span className="block">Public testnet beta documentation index.</span>
        </Link>
        <a
          href="https://github.com/DeOpt"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="api-page-link-github"
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            GitHub
          </span>
          <span className="block">Source repo + public issue tracker.</span>
        </a>
        <Link
          href="/feedback"
          data-testid="api-page-link-feedback"
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Feedback
          </span>
          <span className="block">Ask a question or report a missing piece.</span>
        </Link>
      </section>
    </div>
  );
}
