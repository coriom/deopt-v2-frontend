import Link from "next/link";
import { FeedbackForm } from "./FeedbackForm";

export default function FeedbackPage() {
  return (
    <div className="flex flex-col gap-6">
      <section
        data-testid="feedback-intro"
        className="rounded-lg border border-emerald-500/30 bg-zinc-950 p-5"
      >
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Feedback · public testnet beta
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-100">
          Report a bug
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          DeOpt V2 is a{" "}
          <strong className="text-emerald-300">
            public testnet beta — unaudited, experimental, Base Sepolia only
          </strong>
          . Bug reports are very welcome. Fill the form below and copy the
          public-safe template into Discord or GitHub.
        </p>
      </section>

      <section
        data-testid="feedback-safety"
        className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100"
      >
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-red-200">
          Never share these
        </h2>
        <ul className="ml-4 mt-2 list-disc text-[12px] text-red-100">
          <li>
            <strong>Private keys.</strong> Not the full key. Not a partial key.
            Not in a screenshot. Not in a video. Not ever.
          </li>
          <li>
            <strong>Seed phrases / mnemonics.</strong> Same — twelve, eighteen,
            or twenty-four words, none of them, ever.
          </li>
          <li>
            <strong>RPC URLs with embedded API keys</strong> (
            <code className="rounded bg-black/30 px-1 text-[11px]">
              https://eth-sepolia.g.alchemy.com/v2/&lt;your-key&gt;
            </code>
            ). Redact the key segment.
          </li>
          <li>
            <strong>Admin bearer tokens.</strong> If you somehow saw one, DM
            the maintainer team privately — do NOT post it.
          </li>
          <li>
            <strong>Backend <code>.env</code> contents.</strong> Same.
          </li>
        </ul>
        <p className="mt-3 text-[11px] text-red-200">
          The DeOpt team will NEVER ask you for any of these. If anyone in the
          community asks claiming to be from DeOpt, they are an impostor —
          block and report.
        </p>
      </section>

      <section
        aria-labelledby="feedback-form-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="feedback-form-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200"
        >
          Bug-report template
        </h2>
        <p className="text-[12px] text-zinc-400">
          Fill in what you can — partial reports are still useful. The
          preview below updates as you type. Click <em>Copy bug report</em> to
          put a public-safe text block on your clipboard, then paste it in
          Discord or open a GitHub issue.
        </p>
        <FeedbackForm />
      </section>

      <section
        aria-labelledby="feedback-channels-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="feedback-channels-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200"
        >
          Where to send it
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="https://discord.gg/zaEMvWuxu"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="feedback-channel-discord"
            className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
          >
            <h3 className="text-sm font-semibold text-zinc-100">Discord</h3>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Real-time community chat for testers. Best for quick reproductions
              and questions. Operator on-call best-effort.
            </p>
            <span className="mt-1 break-all font-mono text-[10px] text-emerald-300 group-hover:text-emerald-200">
              https://discord.gg/zaEMvWuxu
            </span>
          </a>
          <a
            href="https://github.com/DeOpt"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="feedback-channel-github"
            className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
          >
            <h3 className="text-sm font-semibold text-zinc-100">GitHub</h3>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Public source + issues. Open a public issue for normal bugs.
              For security-impacting issues, use the private GitHub Security
              Advisory path on the relevant repo.
            </p>
            <span className="mt-1 break-all font-mono text-[10px] text-emerald-300 group-hover:text-emerald-200">
              https://github.com/DeOpt
            </span>
          </a>
        </div>
        <p className="text-[10px] text-zinc-500">
          A future iteration may add a hosted feedback form. For now, Discord
          and GitHub are the canonical channels — the frontend does not run
          its own email server.
        </p>
      </section>

      <nav className="text-[11px]">
        <Link href="/docs" className="text-emerald-300 hover:text-emerald-200">
          ← Back to docs
        </Link>
      </nav>
    </div>
  );
}
