// Cosmic-protocol landing — V2 polish.
//
// Polish over the V1 landing:
//   - copy density reduced; every section reads in 1-2 lines
//   - vertical rhythm doubled (`py-32` / `sm:py-40`)
//   - each section fades in via `<SectionReveal>` IntersectionObserver
//   - background evolves with scroll via `CosmicBackdrop`'s
//     `--cosmic-progress` CSS variable
//   - 1-2 Greek glyphs float in background per section (low opacity)
//   - FAQ accordion landed via `<FaqSection>`
//
// Visual budget: pure Tailwind + inline SVG + `next/image` for the
// operator-supplied Greek PNGs. No new runtime deps.

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { FaqSection } from "./FaqSection";
import { SectionReveal } from "./SectionReveal";

const GREEK_LOGOS = [
  { letter: "Δ", name: "Delta", src: "/greeks/Logo_Delta.png" },
  { letter: "Γ", name: "Gamma", src: "/greeks/Logo_Gamma.png" },
  { letter: "Θ", name: "Theta", src: "/greeks/Logo_Theta.png" },
  { letter: "Ν", name: "Vega", src: "/greeks/Logo_Vega.png" },
  { letter: "Ρ", name: "Rho", src: "/greeks/Logo_Rho.png" },
] as const;

function Chip({ children, testid }: { children: ReactNode; testid?: string }) {
  return (
    <span
      data-testid={testid}
      className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200"
    >
      <span className="h-1 w-1 rounded-full bg-emerald-400" />
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
      <span className="h-px w-6 bg-emerald-500/50" />
      {children}
    </span>
  );
}

function GlassCard({
  children,
  className = "",
  testid,
}: {
  children: ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <div
      data-testid={testid}
      className={`relative overflow-hidden rounded-xl border border-emerald-500/20 bg-zinc-950/40 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.05),0_40px_120px_-50px_rgba(16,185,129,0.3)] backdrop-blur-sm ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
      />
      {children}
    </div>
  );
}

/** Faded, decorative Greek glyph used as a section sigil. Positioned
 *  absolutely, low opacity, never blocks pointer events. */
function GreekSilhouette({
  name,
  src,
  className,
}: {
  name: string;
  src: string;
  className: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid={`landing-greek-silhouette-${name.toLowerCase()}`}
      className={`pointer-events-none absolute select-none opacity-[0.05] sm:opacity-[0.07] ${className}`}
    >
      <Image
        src={src}
        alt=""
        width={400}
        height={400}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function HeroSection() {
  return (
    <SectionReveal
      testid="landing-hero"
      className="relative flex min-h-[80vh] flex-col items-center justify-center gap-10 px-4 pb-24 pt-24 text-center sm:pt-32"
    >
      <Chip testid="landing-hero-eyebrow">Programmable derivatives</Chip>

      <h1
        data-testid="landing-hero-headline"
        className="max-w-4xl text-balance text-5xl font-bold tracking-tight text-zinc-100 sm:text-6xl lg:text-7xl"
      >
        Programmable derivatives.{" "}
        <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
          On chain.
        </span>
      </h1>

      <p
        data-testid="landing-hero-subhead"
        className="max-w-xl text-balance text-base leading-relaxed text-zinc-400"
      >
        Options and perpetuals through a single on-chain execution layer.
      </p>

      <div
        data-testid="landing-hero-cta-row"
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          href="/trade"
          data-testid="landing-cta-launch-app"
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_28px_rgba(16,185,129,0.4)] hover:bg-emerald-400"
        >
          Launch the terminal
        </Link>
        <Link
          href="/markets"
          data-testid="landing-cta-markets"
          className="rounded-md border border-emerald-500/40 bg-black/40 px-5 py-2.5 text-[13px] font-semibold text-emerald-200 backdrop-blur-sm hover:bg-emerald-500/10"
        >
          Markets
        </Link>
        <Link
          href="/docs"
          data-testid="landing-cta-docs"
          className="rounded-md border border-zinc-800 bg-black/40 px-5 py-2.5 text-[13px] font-semibold text-zinc-300 backdrop-blur-sm hover:border-emerald-500/40 hover:text-emerald-200"
        >
          Docs
        </Link>
      </div>

      {/* Greek constellation */}
      <div
        data-testid="landing-hero-greeks"
        className="mt-6 grid grid-cols-5 gap-3 sm:gap-6"
      >
        {GREEK_LOGOS.map((g) => (
          <div
            key={g.name}
            data-testid={`landing-hero-greek-${g.name.toLowerCase()}`}
            className="group flex flex-col items-center gap-1.5"
            title={g.name}
          >
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-emerald-500/30 bg-zinc-950/60 p-2 transition group-hover:border-emerald-400/60 sm:h-14 sm:w-14">
              <Image
                src={g.src}
                alt={`${g.name} Greek logo`}
                width={56}
                height={56}
                className="h-full w-full object-contain opacity-80 group-hover:opacity-100"
                priority={g.name === "Delta"}
              />
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 group-hover:text-emerald-300">
              {g.name}
            </span>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}

function OptionsSection() {
  return (
    <SectionReveal
      testid="landing-options-section"
      className="relative grid grid-cols-1 gap-12 px-4 py-32 sm:py-40 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16"
    >
      <GreekSilhouette
        name="Delta"
        src="/greeks/Logo_Delta.png"
        className="-left-20 top-10 h-72 w-72 sm:h-96 sm:w-96"
      />

      <div className="relative flex flex-col gap-5">
        <Eyebrow>Options</Eyebrow>
        <h2 className="text-4xl font-semibold tracking-tight text-zinc-100">
          Calls. Puts. Greeks.
        </h2>
        <p className="text-base leading-relaxed text-zinc-400">
          A programmable options chain with payoff, Greeks, and collateral
          in one terminal.
        </p>
        <div
          data-testid="landing-options-chips"
          className="flex flex-wrap gap-2"
        >
          <Chip>Chain</Chip>
          <Chip>Payoff</Chip>
          <Chip>Delta</Chip>
          <Chip>Gamma</Chip>
          <Chip>Vega</Chip>
          <Chip>Theta</Chip>
          <Chip>Collateral</Chip>
        </div>
        <div>
          <Link
            href="/trade"
            data-testid="landing-options-cta"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-[13px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            Open the options terminal →
          </Link>
        </div>
      </div>

      <GlassCard
        testid="landing-options-mock"
        className="font-mono text-[11px] text-zinc-300"
      >
        <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-emerald-300">
          <span>WETH · 30d</span>
          <span className="text-zinc-500">chain</span>
        </div>
        <div className="grid grid-cols-7 gap-x-3 gap-y-1 text-right">
          <span className="col-span-3 text-left text-emerald-400">Calls</span>
          <span className="text-center text-zinc-500">Strike</span>
          <span className="col-span-3 text-emerald-400">Puts</span>
          {[
            ["0.12", "0.18", "0.06", "2500", "0.05", "0.11", "0.20"],
            ["0.08", "0.14", "0.04", "3000", "0.04", "0.09", "0.16"],
            ["0.05", "0.10", "0.03", "3500", "0.03", "0.07", "0.13"],
          ].map((row, i) => (
            <div
              key={`row-${i}`}
              className="col-span-7 grid grid-cols-7 gap-x-3"
            >
              <span className="text-zinc-500">{row[0]}</span>
              <span className="text-emerald-200">{row[1]}</span>
              <span className="text-zinc-500">{row[2]}</span>
              <span className="text-center font-semibold text-zinc-100">
                {row[3]}
              </span>
              <span className="text-zinc-500">{row[4]}</span>
              <span className="text-emerald-200">{row[5]}</span>
              <span className="text-zinc-500">{row[6]}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-emerald-500/10 pt-3 text-[10px] text-zinc-500">
          <span>Δ · Γ · Θ · Ν · Ρ</span>
          <span className="text-emerald-300">payoff · schematic</span>
        </div>
      </GlassCard>
    </SectionReveal>
  );
}

function PerpsSection() {
  return (
    <SectionReveal
      testid="landing-perps-section"
      className="relative grid grid-cols-1 gap-12 px-4 py-32 sm:py-40 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16"
    >
      <GreekSilhouette
        name="Theta"
        src="/greeks/Logo_Theta.png"
        className="-right-24 top-10 h-72 w-72 sm:h-96 sm:w-96"
      />

      <GlassCard
        testid="landing-perps-mock"
        className="order-2 font-mono text-[11px] text-zinc-300 lg:order-1"
      >
        <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-emerald-300">
          <span>WETH-PERP</span>
          <span className="text-zinc-500">workspace</span>
        </div>
        <svg
          viewBox="0 0 600 180"
          className="h-32 w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="perps-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16,185,129,0.4)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0)" />
            </linearGradient>
          </defs>
          <path
            d="M0 130 C 60 110, 120 140, 180 100 S 300 70, 360 90 S 480 60, 600 80 L 600 180 L 0 180 Z"
            fill="url(#perps-fill)"
          />
          <path
            d="M0 130 C 60 110, 120 140, 180 100 S 300 70, 360 90 S 480 60, 600 80"
            stroke="rgba(110, 231, 183, 0.7)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
        <div className="mt-4 grid grid-cols-4 gap-2 text-[10px] text-zinc-500">
          {[
            { label: "Mark" },
            { label: "Funding" },
            { label: "OI" },
            { label: "24h" },
          ].map((c) => (
            <div key={c.label}>
              <div className="text-zinc-600">{c.label}</div>
              <div className="font-mono text-zinc-300">—</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="relative order-1 flex flex-col gap-5 lg:order-2">
        <Eyebrow>Perps</Eyebrow>
        <h2 className="text-4xl font-semibold tracking-tight text-zinc-100">
          Perpetuals. Same stack.
        </h2>
        <p className="text-base leading-relaxed text-zinc-400">
          The perps surface lives next to the options terminal — same
          intent pipeline, same risk engine, same vault.
        </p>
        <div
          data-testid="landing-perps-chips"
          className="flex flex-wrap gap-2"
        >
          <Chip>Perpetual</Chip>
          <Chip>Funding</Chip>
          <Chip>Mark</Chip>
          <Chip>OI</Chip>
          <Chip>Cross margin</Chip>
        </div>
        <div>
          <Link
            href="/perps"
            data-testid="landing-perps-cta"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-[13px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            Open the perps workspace →
          </Link>
        </div>
      </div>
    </SectionReveal>
  );
}

function ExecutionSection() {
  const steps = [
    { id: "intent", title: "Signed intent", body: "EIP-712 · client-side." },
    { id: "execution", title: "Execution", body: "Match · validate · broadcast." },
    { id: "settlement", title: "Settlement", body: "Oracle mark · indexed events." },
  ];
  return (
    <SectionReveal
      testid="landing-protocol-flow"
      className="relative flex flex-col gap-12 px-4 py-32 sm:py-40"
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <Eyebrow>Execution layer</Eyebrow>
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100">
          Intent → execution → settlement.
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <GlassCard
            key={s.id}
            testid={`landing-flow-step-${s.id}`}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400">
                Stage {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-[10px] text-zinc-600">
                EIP-712
              </span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100">{s.title}</h3>
            <p className="text-[13px] leading-relaxed text-zinc-400">{s.body}</p>
          </GlassCard>
        ))}
      </div>
    </SectionReveal>
  );
}

function ArchitectureSection() {
  const nodes = [
    { id: "intent", label: "Intent", x: 50, y: 50 },
    { id: "executor", label: "Executor", x: 250, y: 50 },
    { id: "margin", label: "Risk", x: 250, y: 170 },
    { id: "vault", label: "Vault", x: 450, y: 110 },
    { id: "oracle", label: "Oracle", x: 450, y: 230 },
    { id: "settle", label: "Settle", x: 650, y: 110 },
    { id: "indexer", label: "Indexer", x: 650, y: 230 },
  ] as const;
  const edges = [
    ["intent", "executor"],
    ["executor", "margin"],
    ["executor", "vault"],
    ["margin", "vault"],
    ["vault", "settle"],
    ["oracle", "settle"],
    ["oracle", "margin"],
    ["settle", "indexer"],
  ] as const;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <SectionReveal
      testid="landing-architecture-section"
      className="relative flex flex-col gap-12 px-4 py-32 sm:py-40"
    >
      <GreekSilhouette
        name="Gamma"
        src="/greeks/Logo_Gamma.png"
        className="right-0 top-20 h-80 w-80 sm:h-[28rem] sm:w-[28rem]"
      />

      <header className="relative flex flex-col items-center gap-3 text-center">
        <Eyebrow>Architecture</Eyebrow>
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100">
          A connected derivatives stack.
        </h2>
      </header>

      <GlassCard testid="landing-architecture-diagram" className="relative">
        <svg
          viewBox="0 0 720 290"
          className="h-72 w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="DeOpt protocol architecture diagram"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(110,231,183,0.6)" />
            </marker>
          </defs>
          {edges.map(([from, to], i) => {
            const a = byId[from];
            const b = byId[to];
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="rgba(110,231,183,0.35)"
                strokeWidth="1"
                strokeDasharray="3 3"
                markerEnd="url(#arrow)"
              />
            );
          })}
          {nodes.map((n) => (
            <g key={n.id} data-node={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={24}
                fill="rgba(16,185,129,0.08)"
                stroke="rgba(110,231,183,0.6)"
                strokeWidth="1"
              />
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(110,231,183,0.95)"
                fontFamily="monospace"
              >
                {n.id}
              </text>
              <text
                x={n.x}
                y={n.y + 40}
                textAnchor="middle"
                fontSize="11"
                fill="rgba(212,212,216,0.85)"
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </GlassCard>

      <div
        data-testid="landing-architecture-chips"
        className="flex flex-wrap justify-center gap-2"
      >
        <Chip>EIP-712</Chip>
        <Chip>Oracle</Chip>
        <Chip>Vault</Chip>
        <Chip>Margin</Chip>
        <Chip>Settlement</Chip>
        <Chip>Indexer</Chip>
      </div>
    </SectionReveal>
  );
}

function FinalCtaSection() {
  return (
    <SectionReveal
      testid="landing-final-cta"
      className="relative flex flex-col items-center gap-8 px-4 pb-32 pt-24 text-center sm:pb-40"
    >
      <GreekSilhouette
        name="Vega"
        src="/greeks/Logo_Vega.png"
        className="left-1/2 top-0 h-64 w-64 -translate-x-1/2 sm:h-80 sm:w-80"
      />
      <Eyebrow>Enter the terminal</Eyebrow>
      <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
        Open the chain.
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/trade"
          data-testid="landing-final-cta-launch"
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_28px_rgba(16,185,129,0.4)] hover:bg-emerald-400"
        >
          Launch the terminal
        </Link>
        <Link
          href="/markets"
          data-testid="landing-final-cta-markets"
          className="rounded-md border border-emerald-500/40 bg-black/40 px-5 py-2.5 text-[13px] font-semibold text-emerald-200 backdrop-blur-sm hover:bg-emerald-500/10"
        >
          Markets
        </Link>
        <Link
          href="/feedback"
          data-testid="landing-final-cta-feedback"
          className="rounded-md border border-zinc-800 bg-black/40 px-5 py-2.5 text-[13px] font-semibold text-zinc-300 backdrop-blur-sm hover:border-emerald-500/40 hover:text-emerald-200"
        >
          Feedback
        </Link>
      </div>
    </SectionReveal>
  );
}

export function CosmicLanding() {
  return (
    <div
      data-testid="cosmic-landing"
      className="relative isolate -mx-3 -my-3 flex flex-col lg:-mx-4 lg:-my-4"
    >
      <CosmicBackdrop />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col">
        <HeroSection />
        <OptionsSection />
        <PerpsSection />
        <ExecutionSection />
        <ArchitectureSection />
        <FaqSection />
        <FinalCtaSection />
      </div>
    </div>
  );
}
