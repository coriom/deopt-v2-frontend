"use client";

// Landing-page FAQ accordion.
//
// Visual: full-width rows · thin emerald separators · large question
// text · plus icon on the right that rotates to an X when open. Uses
// the native `<details>` element so accordion behavior + accessibility
// are handled by the browser without extra state.
//
// Black / deep-green DeOpt identity — no orange / amber / yellow.

import Link from "next/link";

interface FaqItem {
  id: string;
  q: string;
  a: React.ReactNode;
}

const ITEMS: FaqItem[] = [
  {
    id: "what",
    q: "What is DeOpt?",
    a: (
      <>
        An on-chain execution layer for derivatives. Signed intents,
        a programmable risk engine, a unified collateral vault, an
        oracle-aware settlement path.
      </>
    ),
  },
  {
    id: "products",
    q: "Which products can I trade?",
    a: (
      <>
        <span className="text-emerald-300">Options</span> are live in the
        terminal — calls and puts as a programmable ladder.{" "}
        <span className="text-emerald-300">Perpetuals</span> share the same
        pipeline; the workspace ships ahead of the executor.
      </>
    ),
  },
  {
    id: "execution",
    q: "How are trades executed and settled?",
    a: (
      <>
        EIP-712 intents go to the execution layer, the risk engine validates
        margin against the same Greek surface that drives the chain, the
        vault moves collateral, and settlement reads the oracle mark — all
        observable through an indexed event stream.
      </>
    ),
  },
  {
    id: "risk",
    q: "What collateral and margin model does DeOpt use?",
    a: (
      <>
        Per-position initial and maintenance margin, cross-margin across
        option legs (and later perpetuals), routed through a single
        collateral vault per market segment.
      </>
    ),
  },
  {
    id: "api",
    q: "Does DeOpt expose an API?",
    a: (
      <>
        A public read-side is available (
        <Link href="/api" className="text-emerald-300 hover:text-emerald-200">
          /api
        </Link>
        ). A reference for every endpoint lands as the surface stabilises.
        There is no public write surface — trades flow through the
        connected wallet.
      </>
    ),
  },
  {
    id: "fees",
    q: "What about fees?",
    a: (
      <>
        Documented at{" "}
        <Link href="/fees" className="text-emerald-300 hover:text-emerald-200">
          /fees
        </Link>
        . The fee schedule is being finalised alongside the executor cut and
        rebate policy.
      </>
    ),
  },
  {
    id: "more",
    q: "Where can I learn more?",
    a: (
      <>
        Start with{" "}
        <Link href="/docs" className="text-emerald-300 hover:text-emerald-200">
          /docs
        </Link>{" "}
        for the quickstart, limitations, and FAQ. Open the conversation in
        the{" "}
        <a
          href="https://discord.gg/zaEMvWuxu"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-300 hover:text-emerald-200"
        >
          Discord
        </a>
        .
      </>
    ),
  },
];

export function FaqSection() {
  return (
    <section
      data-testid="landing-faq-section"
      className="relative px-4 py-32 sm:py-40"
    >
      <header className="mx-auto mb-12 flex max-w-3xl flex-col items-center gap-3 text-center sm:mb-16">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
          <span className="h-px w-6 bg-emerald-500/50" />
          FAQ
        </span>
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Frequently asked.
        </h2>
      </header>

      <div
        data-testid="landing-faq-list"
        className="mx-auto flex max-w-3xl flex-col"
      >
        {ITEMS.map((item, i) => (
          <details
            key={item.id}
            data-testid={`landing-faq-item-${item.id}`}
            className={[
              "group border-b border-emerald-500/15 px-2 py-6 transition-colors hover:border-emerald-500/30",
              i === 0 ? "border-t border-emerald-500/15" : "",
            ].join(" ")}
          >
            <summary
              data-testid={`landing-faq-summary-${item.id}`}
              className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg font-semibold text-zinc-100 outline-none transition-colors hover:text-emerald-200 focus-visible:text-emerald-200 sm:text-xl"
            >
              <span>{item.q}</span>
              <span
                aria-hidden="true"
                data-testid={`landing-faq-icon-${item.id}`}
                className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full border border-emerald-500/40 text-emerald-300 transition-transform duration-300 group-open:rotate-45 group-hover:border-emerald-400/70"
              >
                <span className="absolute h-px w-3 bg-current" />
                <span className="absolute h-3 w-px bg-current" />
              </span>
            </summary>
            <div
              data-testid={`landing-faq-answer-${item.id}`}
              className="mt-4 max-w-2xl text-[14px] leading-relaxed text-zinc-400"
            >
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
