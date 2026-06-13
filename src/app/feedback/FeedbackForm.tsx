"use client";

import { useMemo, useState } from "react";

/**
 * Interactive bug-report template. Fully client-side. No fetch, no
 * backend, no email server. The Copy button assembles a public-safe
 * report block and writes it to the clipboard; the tester then sends
 * via Discord, GitHub, or any other channel.
 *
 * Safety rules enforced by construction:
 *   - No password / private-key / seed-phrase / RPC-URL / admin-token
 *     fields exist in the form. Cannot be entered, cannot be assembled.
 *   - Wallet PUBLIC address field only — the placeholder shows the
 *     truncated 0x… shape; the label calls it "PUBLIC" explicitly.
 *   - The rendered template ends with an explicit reminder bullet.
 */
interface FormState {
  title: string;
  scenario: string;
  walletPublicAddress: string;
  chainId: string;
  txHash: string;
  browser: string;
  wallet: string;
  steps: string;
  expected: string;
  actual: string;
  screenshots: string;
}

const INITIAL: FormState = {
  title: "",
  scenario: "",
  walletPublicAddress: "",
  chainId: "84532",
  txHash: "",
  browser: "",
  wallet: "",
  steps: "",
  expected: "",
  actual: "",
  screenshots: "",
};

function assembleReport(s: FormState): string {
  const lines: string[] = [];
  lines.push("### Issue title");
  lines.push("");
  lines.push(s.title || "(fill in)");
  lines.push("");
  lines.push("### Test scenario");
  lines.push("");
  lines.push(s.scenario || "(what were you trying to do?)");
  lines.push("");
  lines.push("### Environment");
  lines.push("");
  lines.push(
    `- Wallet PUBLIC address (Base Sepolia): ${s.walletPublicAddress || "0x... (PUBLIC only — never paste a private key)"}`,
  );
  lines.push(`- Network: Base Sepolia`);
  lines.push(`- Chain id seen by the app: ${s.chainId || "84532"}`);
  lines.push(`- Tx hash (if any): ${s.txHash || "n/a"}`);
  lines.push(`- Were you on Base Sepolia at the time? yes`);
  lines.push(
    `- Were real funds involved? no  ← expected answer is no; this is testnet only`,
  );
  lines.push(`- Browser + version: ${s.browser || "(e.g. Chrome 128)"}`);
  lines.push(`- Wallet provider + version: ${s.wallet || "(e.g. MetaMask 12)"}`);
  lines.push("");
  lines.push("### Steps to reproduce");
  lines.push("");
  lines.push(s.steps || "1. ...\n2. ...\n3. ...");
  lines.push("");
  lines.push("### Expected behavior");
  lines.push("");
  lines.push(s.expected || "(what you thought should happen)");
  lines.push("");
  lines.push("### Actual behavior");
  lines.push("");
  lines.push(s.actual || "(what actually happened, including any error text)");
  lines.push("");
  lines.push("### Screenshots / short video");
  lines.push("");
  lines.push(s.screenshots || "(attach when posting; crop or blur anything sensitive)");
  lines.push("");
  lines.push(
    "# NEVER share private keys, seed phrases, RPC URLs with embedded API keys,",
  );
  lines.push("# admin bearer tokens, or .env contents.");
  return lines.join("\n");
}

function field<K extends keyof FormState>(
  state: FormState,
  setState: (s: FormState) => void,
  key: K,
  rest: Partial<FormState>,
): void {
  setState({ ...state, ...rest, [key]: rest[key] ?? state[key] });
}

export function FeedbackForm() {
  const [s, setS] = useState<FormState>(INITIAL);
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => assembleReport(s), [s]);

  const update = (patch: Partial<FormState>) => field(s, setS, "title", patch);

  return (
    <div className="flex flex-col gap-4">
      <div
        data-testid="feedback-form"
        className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-2"
      >
        <Label label="Issue title">
          <input
            type="text"
            value={s.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="One short sentence"
            data-testid="feedback-input-title"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Wallet PUBLIC address (Base Sepolia)">
          <input
            type="text"
            value={s.walletPublicAddress}
            onChange={(e) => update({ walletPublicAddress: e.target.value })}
            placeholder="0x... (PUBLIC only)"
            data-testid="feedback-input-wallet"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Chain id (default 84532)" htmlForOverride="chain-id">
          <input
            type="text"
            id="chain-id"
            value={s.chainId}
            onChange={(e) => update({ chainId: e.target.value })}
            inputMode="numeric"
            data-testid="feedback-input-chain-id"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Tx hash (if any)">
          <input
            type="text"
            value={s.txHash}
            onChange={(e) => update({ txHash: e.target.value })}
            placeholder="0x..."
            data-testid="feedback-input-tx-hash"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Browser + version">
          <input
            type="text"
            value={s.browser}
            onChange={(e) => update({ browser: e.target.value })}
            placeholder="e.g. Chrome 128"
            data-testid="feedback-input-browser"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Wallet provider + version">
          <input
            type="text"
            value={s.wallet}
            onChange={(e) => update({ wallet: e.target.value })}
            placeholder="e.g. MetaMask 12.x"
            data-testid="feedback-input-wallet-provider"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="What were you trying to do?" wide>
          <textarea
            value={s.scenario}
            onChange={(e) => update({ scenario: e.target.value })}
            rows={2}
            placeholder="Buy 1 contract of the ETH-USDC Call at 3000 strike."
            data-testid="feedback-input-scenario"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Steps to reproduce" wide>
          <textarea
            value={s.steps}
            onChange={(e) => update({ steps: e.target.value })}
            rows={4}
            placeholder="1. Connect wallet\n2. ...\n3. ..."
            data-testid="feedback-input-steps"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Expected behavior" wide>
          <textarea
            value={s.expected}
            onChange={(e) => update({ expected: e.target.value })}
            rows={2}
            data-testid="feedback-input-expected"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Actual behavior" wide>
          <textarea
            value={s.actual}
            onChange={(e) => update({ actual: e.target.value })}
            rows={2}
            data-testid="feedback-input-actual"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
        <Label label="Screenshots / video (description; attach when posting)" wide>
          <textarea
            value={s.screenshots}
            onChange={(e) => update({ screenshots: e.target.value })}
            rows={2}
            placeholder="Crop or blur anything sensitive before posting."
            data-testid="feedback-input-screenshots"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </Label>
      </div>

      <section
        aria-labelledby="feedback-preview-heading"
        className="flex flex-col gap-2"
      >
        <h2
          id="feedback-preview-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200"
        >
          Bug-report preview
        </h2>
        <pre
          data-testid="feedback-preview"
          className="max-h-[24rem] overflow-auto rounded-lg border border-zinc-800 bg-black/40 p-3 font-mono text-[11px] leading-snug text-zinc-200"
        >
          {report}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // clipboard may be unavailable in some browsers; the <pre>
                // remains selectable for manual copy.
              }
            }}
            data-testid="feedback-copy-button"
            className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
          >
            {copied ? "Copied!" : "Copy bug report"}
          </button>
          <a
            href="https://discord.gg/zaEMvWuxu"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="feedback-discord-cta"
            className="rounded border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
          >
            Paste in Discord
          </a>
          <a
            href="https://github.com/DeOpt"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="feedback-github-cta"
            className="rounded border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
          >
            Open GitHub issue
          </a>
        </div>
        <p className="text-[10px] text-zinc-500">
          The frontend never sends this report anywhere on its own. There is no
          server-side email and no third-party analytics. You paste it in the
          channel you choose.
        </p>
      </section>
    </div>
  );
}

function Label({
  label,
  children,
  wide,
  htmlForOverride,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  htmlForOverride?: string;
}) {
  return (
    <label
      htmlFor={htmlForOverride}
      className={`flex flex-col gap-1 text-xs text-zinc-300 ${wide ? "sm:col-span-2" : ""}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
