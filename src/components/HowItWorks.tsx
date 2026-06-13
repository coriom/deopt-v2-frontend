"use client";

/**
 * Compact 6-step "How It Works" card rendered on the landing screen.
 *
 * Posture: public testnet beta, Base Sepolia only, unaudited, no real
 * funds. The component renders the same wording the user sees in
 * `docs/public-beta/USER_TESTING_GUIDE.md` — kept short so the landing
 * page stays scannable.
 */

interface Step {
  n: number;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: "Connect a wallet",
    body: "Any EVM wallet that supports Base Sepolia and EIP-712 typed-data signing.",
  },
  {
    n: 2,
    title: "Get test funds",
    body: "A tiny amount of Base Sepolia ETH for gas, plus testnet mUSDC as collateral. All tokens are mocks — no real value.",
  },
  {
    n: 3,
    title: "Preview a quote",
    body: "Pick a series, side, and size. The backend shows premium, fees, and the oracle mark before you sign.",
  },
  {
    n: 4,
    title: "Sign the trade",
    body: "An EIP-712 typed-data signature on a frozen testnet matching engine. Nothing is broadcast from your wallet.",
  },
  {
    n: 5,
    title: "Watch the executor settle",
    body: "An operator-side executor submits the trade on chain. The transaction timeline updates in real time.",
  },
  {
    n: 6,
    title: "Check your position",
    body: "Open the portfolio page to see your long/short position, vault balance, and trade history.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      data-testid="how-it-works"
      className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2
        id="how-it-works-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200"
      >
        How it works
      </h2>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            data-testid={`how-it-works-step-${s.n}`}
            className="flex flex-col gap-1 rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                {s.n}
              </span>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {s.title}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[10px] text-zinc-500 dark:text-zinc-500">
        Public testnet beta — Base Sepolia (chain 84532) only. Unaudited.
        Experimental. No real funds. Mainnet is permanently disabled in this
        build.
      </p>
    </section>
  );
}
