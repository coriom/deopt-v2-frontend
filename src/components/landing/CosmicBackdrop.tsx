"use client";

// Pure CSS + inline SVG + lightweight scroll-driven cosmic backdrop.
//
// V2 polish (FRONTEND-HOMEPAGE-COSMIC-LANDING-POLISH-V2):
//   - the dot field now drifts via a slow CSS @keyframes (declared in
//     globals.css under the `deopt-cosmic-*` namespace so this file
//     stays declarative)
//   - one SVG curve animates a `stroke-dashoffset` for a subtle
//     data-stream feel
//   - scroll position drives a `--cosmic-progress` CSS variable on
//     the backdrop root, which the inline gradients read to evolve
//     glow position / opacity as the user scrolls deeper
//   - `prefers-reduced-motion: reduce` short-circuits the scroll
//     listener AND disables the dot drift / dash animation via CSS
//
// Renders as `fixed inset-0 -z-10 pointer-events-none` so it escapes
// the page-mode max-width wrapper and never intercepts clicks.

import { useEffect, useRef } from "react";

export function CosmicBackdrop() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      el.style.setProperty("--cosmic-progress", "0.5");
      return;
    }
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      el.style.setProperty("--cosmic-progress", p.toFixed(4));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="cosmic-backdrop"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black"
      style={{ ["--cosmic-progress" as never]: "0" }}
    >
      {/* Base — interpolated by the inline calc() expression below.
          The top-right glow drifts down + brightens as scroll progress
          climbs; the bottom-left glow drifts up. */}
      <div
        data-testid="cosmic-base"
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(circle at calc(80% - (var(--cosmic-progress, 0) * 30%)) calc(0% + (var(--cosmic-progress, 0) * 60%)), rgba(16, 185, 129, calc(0.08 + var(--cosmic-progress, 0) * 0.06)), transparent 55%)",
            "radial-gradient(circle at calc(10% + (var(--cosmic-progress, 0) * 25%)) calc(100% - (var(--cosmic-progress, 0) * 60%)), rgba(16, 185, 129, calc(0.06 + var(--cosmic-progress, 0) * 0.05)), transparent 50%)",
            "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(8,12,10,1) 100%)",
          ].join(", "),
          transition: "background-image 250ms linear",
        }}
      />

      {/* Drifting dot field. Slow downward translation via CSS
          keyframes declared in globals.css. Reduced-motion users
          see a static field. */}
      <div
        data-testid="cosmic-dotfield"
        className="deopt-cosmic-dotfield absolute inset-0 opacity-60"
      />

      {/* Subtle scanlines */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(110, 231, 183, 0.6) 0px, rgba(110, 231, 183, 0.6) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* Vol smile + data-stream curves */}
      <svg
        data-testid="cosmic-curves"
        className="absolute left-0 top-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cosmic-vol" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
            <stop offset="40%" stopColor="rgba(16, 185, 129, 0.35)" />
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
          </linearGradient>
          <linearGradient id="cosmic-stream" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(110, 231, 183, 0)" />
            <stop offset="60%" stopColor="rgba(110, 231, 183, 0.25)" />
            <stop offset="100%" stopColor="rgba(110, 231, 183, 0)" />
          </linearGradient>
        </defs>
        {/* Vol curve — upper third */}
        <path
          d="M -50 320 C 250 220, 500 280, 800 240 S 1300 200, 1700 260"
          fill="none"
          stroke="url(#cosmic-vol)"
          strokeWidth="1.5"
        />
        {/* Data stream — middle. `stroke-dasharray` + animated
            `stroke-dashoffset` drives the slow data-flow feel. */}
        <path
          className="deopt-cosmic-stream"
          d="M -100 540 C 200 580, 460 500, 720 540 S 1180 600, 1700 520"
          fill="none"
          stroke="url(#cosmic-stream)"
          strokeWidth="1"
          strokeDasharray="6 18"
        />
        {/* Second-order vol — lower */}
        <path
          d="M -50 760 C 220 700, 540 760, 880 720 S 1300 760, 1700 700"
          fill="none"
          stroke="url(#cosmic-stream)"
          strokeWidth="1"
        />
      </svg>

      {/* Vignette — strengthens as user scrolls deeper. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent calc(60% - var(--cosmic-progress, 0) * 20%), rgba(0,0,0, calc(0.8 + var(--cosmic-progress, 0) * 0.15)) 100%)",
          transition: "background 250ms linear",
        }}
      />
    </div>
  );
}
