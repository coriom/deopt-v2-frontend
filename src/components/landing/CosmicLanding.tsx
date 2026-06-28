// Particle-field landing — V5.
//
// V5 direction shift:
//   - DNA / helix backdrop removed. Replaced by `<ParticleField>` —
//     a canvas-based interactive particle field that reacts to the
//     cursor (gentle attraction) and clicks (decaying repulsion),
//     and morphs across four modes (calm → wave → nodes → sparse)
//     driven by scroll progress.
//   - The rest of the V4 landing stays put: new hero copy, soft glass
//     panels, Options + Perps split section, soft architecture, risk
//     callouts, FAQ.
//
// Visual budget: pure Tailwind + inline SVG + `next/image` for the
// operator-supplied Greek PNGs + one HTML canvas. No new runtime deps.

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ParticleField } from "./ParticleField";
import { FaqSection } from "./FaqSection";
import { SectionReveal } from "./SectionReveal";

function Chip({ children, testid }: { children: ReactNode; testid?: string }) {
  return (
    <span
      data-testid={testid}
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/[0.06] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200 ring-1 ring-inset ring-emerald-500/20"
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

/** Soft panel — replaces the V3 `<GlassCard>` style. No hard 1px
 *  emerald border; the panel sits in the DNA field via a soft
 *  gradient surface + inset glow. */
function SoftPanel({
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
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-950/55 to-zinc-950/15 p-6 backdrop-blur-md ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_-30px_rgba(16,185,129,0.35),inset_0_1px_0_0_rgba(110,231,183,0.08)]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function GreekSilhouette({
  name,
  src,
  className,
  testidSuffix,
}: {
  name: string;
  src: string;
  className: string;
  testidSuffix?: string;
}) {
  const id = `landing-greek-silhouette-${name.toLowerCase()}${
    testidSuffix ? `-${testidSuffix}` : ""
  }`;
  return (
    <div
      aria-hidden="true"
      data-testid={id}
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

/** Vertical side-rail of chips used to fill large-screen whitespace
 *  on either side of the central content column. Hidden on small
 *  viewports so it never wraps awkwardly. */
function SideRail({
  side,
  items,
  testid,
}: {
  side: "left" | "right";
  items: string[];
  testid: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid={testid}
      className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 flex-col gap-2 lg:flex ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      {items.map((label) => (
        <span
          key={label}
          className="rounded-full bg-emerald-500/[0.04] px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-200/80 ring-1 ring-inset ring-emerald-500/15 backdrop-blur-sm"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** Compact terminal-style readout strip — fills large-screen
 *  horizontal whitespace under the hero. Honest placeholder dashes
 *  only (no fake liquidity, no fake greeks). */
function HeroReadout() {
  const cells = [
    { id: "delta", label: "Δ", v: "—" },
    { id: "gamma", label: "Γ", v: "—" },
    { id: "theta", label: "Θ", v: "—" },
    { id: "vega", label: "Ν", v: "—" },
    { id: "rho", label: "Ρ", v: "—" },
    { id: "vault", label: "Vault", v: "—" },
    { id: "oracle", label: "Oracle", v: "—" },
    { id: "eip", label: "EIP-712", v: "ok" },
  ];
  return (
    <div
      data-testid="landing-hero-readout"
      className="mt-12 hidden w-full max-w-3xl items-stretch gap-px overflow-hidden rounded-full bg-emerald-500/10 px-px py-px font-mono text-[10px] backdrop-blur-md sm:flex"
    >
      {cells.map((c) => (
        <div
          key={c.id}
          data-testid={`landing-hero-readout-${c.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 bg-black/60 px-3 py-1.5 text-zinc-400 first:rounded-l-full last:rounded-r-full"
        >
          <span className="text-emerald-300">{c.label}</span>
          <span>{c.v}</span>
        </div>
      ))}
    </div>
  );
}

function HeroSection() {
  return (
    <SectionReveal
      testid="landing-hero"
      className="relative flex min-h-[88vh] flex-col items-center justify-center gap-8 px-4 pb-24 pt-24 text-center sm:pt-32"
    >
      <SideRail
        side="left"
        items={["Intent", "Margin", "Vault", "Oracle"]}
        testid="landing-hero-rail-left"
      />
      <SideRail
        side="right"
        items={["Settle", "Indexer", "Funding", "Δ Γ Θ"]}
        testid="landing-hero-rail-right"
      />

      <GreekSilhouette
        name="Rho"
        src="/greeks/Logo_Rho.png"
        className="-right-24 top-12 h-72 w-72 sm:h-96 sm:w-96"
        testidSuffix="hero"
      />
      <GreekSilhouette
        name="Vega"
        src="/greeks/Logo_Vega.png"
        className="-left-20 bottom-10 h-64 w-64 sm:h-80 sm:w-80"
        testidSuffix="hero"
      />
      <GreekSilhouette
        name="Gamma"
        src="/greeks/Logo_Gamma.png"
        className="left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 sm:h-56 sm:w-56"
        testidSuffix="hero-center"
      />

      <h1
        data-testid="landing-hero-headline"
        className="relative max-w-5xl text-balance text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl"
      >
        Decentralized options and perps with{" "}
        <span className="bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-500 bg-clip-text text-transparent">
          low-fee execution, APIs, and customizable trading workspaces.
        </span>
      </h1>

      <p
        data-testid="landing-hero-subhead"
        className="relative max-w-2xl text-balance text-base leading-relaxed text-zinc-400"
      >
        Trade and build on a derivatives interface designed for options chains,
        perps workspaces, API access, and modular execution flows.
      </p>

      <div
        data-testid="landing-hero-cta-row"
        className="relative flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          href="/options"
          data-testid="landing-cta-launch-app"
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_28px_rgba(16,185,129,0.4)] hover:bg-emerald-400"
        >
          Launch the terminal
        </Link>
        <Link
          href="/markets"
          data-testid="landing-cta-markets"
          className="rounded-md px-5 py-2.5 text-[13px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-500/40 backdrop-blur-sm hover:bg-emerald-500/10"
        >
          Markets
        </Link>
        <Link
          href="/docs"
          data-testid="landing-cta-docs"
          className="rounded-md px-5 py-2.5 text-[13px] font-semibold text-zinc-300 ring-1 ring-inset ring-zinc-800 backdrop-blur-sm hover:text-emerald-200 hover:ring-emerald-500/40"
        >
          Docs
        </Link>
      </div>

      <HeroReadout />
    </SectionReveal>
  );
}

function OptionsAndPerpsSection() {
  return (
    <SectionReveal
      testid="landing-products-section"
      className="relative px-4 py-32 sm:py-40"
    >
      <GreekSilhouette
        name="Delta"
        src="/greeks/Logo_Delta.png"
        className="-left-20 top-10 h-72 w-72 sm:h-96 sm:w-96"
      />
      <GreekSilhouette
        name="Theta"
        src="/greeks/Logo_Theta.png"
        className="-right-20 bottom-10 h-72 w-72 sm:h-96 sm:w-96"
      />
      <GreekSilhouette
        name="Rho"
        src="/greeks/Logo_Rho.png"
        className="right-1/3 top-20 h-36 w-36 sm:h-48 sm:w-48"
        testidSuffix="products-mid"
      />
      <GreekSilhouette
        name="Vega"
        src="/greeks/Logo_Vega.png"
        className="left-1/4 bottom-20 h-36 w-36 sm:h-48 sm:w-48"
        testidSuffix="products-mid"
      />

      <header className="relative mb-12 flex flex-col items-center gap-3 text-center sm:mb-16">
        <Eyebrow>Products</Eyebrow>
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100">
          Options. Perps. One terminal.
        </h2>
      </header>

      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        {/* OPTIONS */}
        <div
          data-testid="landing-options-section"
          className="relative flex flex-col gap-5"
        >
          <SoftPanel className="font-mono text-[11px] text-zinc-300">
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
          </SoftPanel>

          <div className="flex flex-col gap-3 px-1">
            <Eyebrow>Options</Eyebrow>
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Calls. Puts. Greeks.
            </h3>
            <p className="text-[14px] leading-relaxed text-zinc-400">
              A programmable chain with payoff, Greeks, and collateral.
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
            </div>
            <Link
              href="/options"
              data-testid="landing-options-cta"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/10"
            >
              Open options terminal →
            </Link>
          </div>
        </div>

        {/* PERPS */}
        <div
          data-testid="landing-perps-section"
          className="relative flex flex-col gap-5"
        >
          <SoftPanel className="font-mono text-[11px] text-zinc-300">
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
          </SoftPanel>

          <div className="flex flex-col gap-3 px-1">
            <Eyebrow>Perps</Eyebrow>
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Perpetuals. Same stack.
            </h3>
            <p className="text-[14px] leading-relaxed text-zinc-400">
              Same intent pipeline, same risk engine, same vault.
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
            <Link
              href="/perps"
              data-testid="landing-perps-cta"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/10"
            >
              Open perps workspace →
            </Link>
          </div>
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
      <SideRail
        side="left"
        items={["EIP-712", "Match", "Settle"]}
        testid="landing-execution-rail-left"
      />
      <SideRail
        side="right"
        items={["Vault", "Oracle", "Indexer"]}
        testid="landing-execution-rail-right"
      />

      <GreekSilhouette
        name="Rho"
        src="/greeks/Logo_Rho.png"
        className="right-0 top-12 h-56 w-56 sm:h-72 sm:w-72"
        testidSuffix="execution"
      />
      <GreekSilhouette
        name="Delta"
        src="/greeks/Logo_Delta.png"
        className="-left-12 bottom-20 h-44 w-44 sm:h-60 sm:w-60"
        testidSuffix="execution-corner"
      />

      <header className="relative flex flex-col items-center gap-3 text-center">
        <Eyebrow>Execution path</Eyebrow>
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100">
          Intent → execution → settlement.
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <SoftPanel
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
          </SoftPanel>
        ))}
      </div>
    </SectionReveal>
  );
}

function ArchNode({
  id,
  label,
  hint,
  emphasis,
}: {
  id: string;
  label: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      data-testid={`landing-arch-node-${id}`}
      data-arch-id={id}
      className={[
        "relative flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-b from-zinc-950/55 to-zinc-950/15 px-4 py-3 text-center backdrop-blur-md",
        emphasis
          ? "shadow-[inset_0_0_80px_-30px_rgba(16,185,129,0.55),inset_0_1px_0_0_rgba(110,231,183,0.18)]"
          : "shadow-[inset_0_0_60px_-30px_rgba(16,185,129,0.3),inset_0_1px_0_0_rgba(110,231,183,0.08)]",
      ].join(" ")}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-emerald-400">
        {id}
      </span>
      <span className="text-[14px] font-semibold text-zinc-100">{label}</span>
      {hint ? (
        <span className="text-[10px] text-zinc-500">{hint}</span>
      ) : null}
    </div>
  );
}

function ArchArrowDown() {
  return (
    <div aria-hidden="true" className="my-2 flex justify-center md:my-3">
      <svg width="16" height="32" viewBox="0 0 16 32" fill="none">
        <line
          x1="8"
          y1="0"
          x2="8"
          y2="22"
          stroke="rgba(110,231,183,0.55)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path
          d="M 3 22 L 8 30 L 13 22"
          stroke="rgba(110,231,183,0.7)"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
    </div>
  );
}

function ArchitectureSection() {
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
      <GreekSilhouette
        name="Vega"
        src="/greeks/Logo_Vega.png"
        className="-left-12 bottom-32 h-48 w-48 sm:h-64 sm:w-64"
        testidSuffix="architecture"
      />

      <header className="relative flex flex-col items-center gap-3 text-center">
        <Eyebrow>Architecture</Eyebrow>
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100">
          One connected derivatives stack.
        </h2>
      </header>

      {/* Borderless container — the architecture sits over the DNA
          strand rather than fighting it with a hard panel border. */}
      <div
        data-testid="landing-architecture-diagram"
        className="relative mx-auto w-full max-w-5xl"
      >
        <div
          data-testid="landing-arch-tier-entry"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <ArchNode id="trader" label="Trader" hint="EIP-712 wallet" />
          <ArchNode id="intent" label="Signed intent" hint="off-chain" />
          <ArchNode
            id="executor"
            label="Execution layer"
            hint="match · validate"
            emphasis
          />
        </div>

        <ArchArrowDown />

        <div
          data-testid="landing-arch-tier-core"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <ArchNode id="margin" label="Margin engine" hint="initial · maint." />
          <ArchNode id="vault" label="Collateral vault" hint="ERC-20 · cross" />
          <ArchNode id="oracle" label="Oracle router" hint="mark · IV" />
        </div>

        <ArchArrowDown />

        <div
          data-testid="landing-arch-tier-output"
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <ArchNode id="settle" label="Settlement" hint="on-chain" emphasis />
          <ArchNode
            id="indexer"
            label="Indexer / portfolio"
            hint="event stream"
          />
        </div>
      </div>

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

function RiskSection() {
  const modules = [
    {
      id: "margin",
      title: "Margin",
      body: "Initial + maintenance per leg.",
      chip: "Cross-leg",
    },
    {
      id: "vault",
      title: "Vault",
      body: "ERC-20 collateral, cross-margined.",
      chip: "ERC-20",
    },
    {
      id: "oracle",
      title: "Oracle",
      body: "Mark + IV through a routed feed.",
      chip: "Routed",
    },
  ];
  return (
    <SectionReveal
      testid="landing-risk-section"
      className="relative flex flex-col gap-12 px-4 py-32 sm:py-40"
    >
      <GreekSilhouette
        name="Theta"
        src="/greeks/Logo_Theta.png"
        className="right-10 top-10 h-56 w-56 sm:h-72 sm:w-72"
        testidSuffix="risk"
      />
      <GreekSilhouette
        name="Gamma"
        src="/greeks/Logo_Gamma.png"
        className="-left-12 bottom-12 h-48 w-48 sm:h-64 sm:w-64"
        testidSuffix="risk"
      />

      <header className="relative flex flex-col items-center gap-3 text-center">
        <Eyebrow>Risk · collateral · oracle</Eyebrow>
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100">
          Programmable risk modules.
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {modules.map((m) => (
          <SoftPanel
            key={m.id}
            testid={`landing-risk-module-${m.id}`}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-100">{m.title}</h3>
              <Chip>{m.chip}</Chip>
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-400">{m.body}</p>
          </SoftPanel>
        ))}
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
      <GreekSilhouette
        name="Rho"
        src="/greeks/Logo_Rho.png"
        className="-left-12 bottom-12 h-44 w-44 sm:h-56 sm:w-56"
        testidSuffix="final-corner"
      />
      <GreekSilhouette
        name="Delta"
        src="/greeks/Logo_Delta.png"
        className="-right-12 bottom-12 h-44 w-44 sm:h-56 sm:w-56"
        testidSuffix="final-right"
      />

      <Eyebrow>Enter the terminal</Eyebrow>
      <h2 className="relative max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
        Open the chain.
      </h2>
      <div className="relative flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/options"
          data-testid="landing-final-cta-launch"
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_28px_rgba(16,185,129,0.4)] hover:bg-emerald-400"
        >
          Launch the terminal
        </Link>
        <Link
          href="/markets"
          data-testid="landing-final-cta-markets"
          className="rounded-md px-5 py-2.5 text-[13px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-500/40 backdrop-blur-sm hover:bg-emerald-500/10"
        >
          Markets
        </Link>
        <Link
          href="/feedback"
          data-testid="landing-final-cta-feedback"
          className="rounded-md px-5 py-2.5 text-[13px] font-semibold text-zinc-300 ring-1 ring-inset ring-zinc-800 backdrop-blur-sm hover:text-emerald-200 hover:ring-emerald-500/40"
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
      <ParticleField />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col">
        <HeroSection />
        <OptionsAndPerpsSection />
        <ExecutionSection />
        <ArchitectureSection />
        <RiskSection />
        <FaqSection />
        <FinalCtaSection />
      </div>
    </div>
  );
}
