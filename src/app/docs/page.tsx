import Link from "next/link";
import { allDocIndexEntries } from "@/lib/docs-loader";

const EXTERNAL_LINKS = [
  {
    id: "discord",
    label: "Discord",
    href: "https://discord.gg/zaEMvWuxu",
    description: "Live community chat for testers. Operator on-call best-effort.",
  },
  {
    id: "github",
    label: "GitHub",
    href: "https://github.com/DeOpt",
    description: "Public source + issues. Open a public issue or a private security advisory.",
  },
];

const FEEDBACK_CARD = {
  id: "feedback",
  label: "Feedback / bug report",
  href: "/feedback",
  description:
    "Public-safe bug report template — copy-to-clipboard, then send via Discord or GitHub.",
};

export default function DocsIndexPage() {
  const docs = allDocIndexEntries();
  return (
    <div className="flex flex-col gap-6">
      <section
        data-testid="docs-index-intro"
        className="rounded-lg border border-emerald-500/30 bg-zinc-950 p-5"
      >
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Public testnet beta docs
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-100">
          DeOpt Public Testnet Beta Docs
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          Everything you need to test DeOpt V2 on Base Sepolia. This is a{" "}
          <strong className="text-emerald-300">
            public testnet beta — unaudited, experimental, Base Sepolia only.
          </strong>{" "}
          All tokens are testnet mocks; no real funds. Mainnet is permanently
          disabled in this build.
        </p>
        <ul className="mt-3 grid gap-1 text-[11px] text-zinc-400 sm:grid-cols-2">
          <li>• Base Sepolia (chain 84532) only. Mainnet is disabled.</li>
          <li>• No real funds. All tokens are testnet mocks.</li>
          <li>• No audit, no bug bounty, no SLA.</li>
          <li>• Addresses, APIs, and behaviour may change without notice.</li>
        </ul>
      </section>

      <section
        aria-labelledby="docs-list-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="docs-list-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200"
        >
          Read the docs
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              data-testid={`docs-card-${doc.slug}`}
              className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
            >
              <h3 className="text-sm font-semibold text-zinc-100">
                {doc.title}
              </h3>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                {doc.description}
              </p>
              <span className="mt-1 text-[10px] text-emerald-300 group-hover:text-emerald-200">
                Open →
              </span>
            </Link>
          ))}
          <Link
            href={FEEDBACK_CARD.href}
            data-testid={`docs-card-${FEEDBACK_CARD.id}`}
            className="group flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 transition hover:border-emerald-500/70 hover:bg-emerald-500/10"
          >
            <h3 className="text-sm font-semibold text-emerald-100">
              {FEEDBACK_CARD.label}
            </h3>
            <p className="text-[11px] leading-relaxed text-zinc-300">
              {FEEDBACK_CARD.description}
            </p>
            <span className="mt-1 text-[10px] text-emerald-300 group-hover:text-emerald-200">
              Open →
            </span>
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="docs-channels-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="docs-channels-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200"
        >
          Community channels
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`docs-channel-${link.id}`}
              className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
            >
              <h3 className="text-sm font-semibold text-zinc-100">
                {link.label}
              </h3>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                {link.description}
              </p>
              <span className="mt-1 break-all font-mono text-[10px] text-emerald-300 group-hover:text-emerald-200">
                {link.href}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
