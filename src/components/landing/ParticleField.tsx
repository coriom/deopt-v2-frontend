"use client";

// Interactive particle-field landing backdrop.
//
// V6 polish over the V5 baseline:
//   - particle target density bumped ~1.7× (`floor((w × h) / 6500)`
//     vs V5's `/ 11000`), clamped 120-320 (V5: 80-180)
//   - particles slightly larger: radius range 0.9-2.5 (V5: 0.6-1.7)
//   - NEW scroll parallax: each particle's `p.y` drifts down by
//     `(scrollY - lastScrollY) × 0.12` every frame so the field
//     reads as suspended in depth, not pinned wallpaper. Wrap-around
//     at viewport edges keeps the field continuous.
//   - existing cursor attraction + click repulsion + scroll-driven
//     mode morphing (calm → wave → nodes → sparse) preserved
//
// `prefers-reduced-motion: reduce` short-circuits the rAF loop and
// renders a single static frame. Canvas is `pointer-events-none` so
// it never blocks page interaction; cursor / click listeners are on
// `window`.

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
}

type Mode = "calm" | "wave" | "nodes" | "sparse";

function pickMode(progress: number): Mode {
  if (progress < 0.25) return "calm";
  if (progress < 0.55) return "wave";
  if (progress < 0.85) return "nodes";
  return "sparse";
}

const PARALLAX_FACTOR = 0.12;

export function ParticleField() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let scrollProgress = 0;
    let lastScrollY = window.scrollY;
    let currentMode: Mode | "" = "";
    const cursor = { x: -9999, y: -9999, active: false };
    const click = { x: 0, y: 0, time: -Infinity };

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function setModeAttribute(mode: Mode) {
      if (currentMode === mode) return;
      currentMode = mode;
      root!.setAttribute("data-particle-mode", mode);
    }

    function setDensityAttribute(count: number) {
      root!.setAttribute("data-particle-density", String(count));
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // V6: target density `~ floor(area / 6500)` clamped 120-320 on
      // desktop; smaller screens collapse to the floor naturally.
      const targetCount = Math.max(
        120,
        Math.min(320, Math.floor((width * height) / 6500)),
      );
      particles = Array.from({ length: targetCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        baseRadius: 0.9 + Math.random() * 1.6,
      }));
      setDensityAttribute(targetCount);
    }

    function onMove(e: PointerEvent) {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      cursor.active = true;
    }
    function onLeave() {
      cursor.active = false;
    }
    function onDown(e: PointerEvent) {
      click.x = e.clientX;
      click.y = e.clientY;
      click.time = performance.now();
    }
    function onScroll() {
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      scrollProgress = Math.min(1, Math.max(0, window.scrollY / max));
      setModeAttribute(pickMode(scrollProgress));
    }

    function drawStaticFrame() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.fillStyle = "rgba(110, 231, 183, 0.32)";
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.baseRadius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function frame(now: number) {
      const mode = scrollProgress;
      const radiusScale = 1 + mode * 0.55;
      const showConnections = mode >= 0.3 && mode <= 0.85;
      const connectionDistance = 60 + mode * 40;
      const curlStrength = mode < 0.55 ? mode * 0.00012 : 0;
      const driftCalm = mode >= 0.85;

      // Scroll parallax — apply ΔscrollY × PARALLAX_FACTOR to every
      // particle's internal y position each frame. Wrap-around at the
      // viewport edges keeps the field visually continuous.
      const sy = window.scrollY;
      const parallaxDrift = (sy - lastScrollY) * PARALLAX_FACTOR;
      lastScrollY = sy;

      const elapsed = now - click.time;
      const clickStrength = elapsed < 600 ? 1 - elapsed / 600 : 0;

      ctx!.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy + parallaxDrift;

        if (curlStrength > 0) {
          const dx = p.x - width / 2;
          const dy = p.y - height / 2;
          p.vx += -dy * curlStrength;
          p.vy += dx * curlStrength;
        }

        if (cursor.active) {
          const dx = cursor.x - p.x;
          const dy = cursor.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 18000) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / Math.sqrt(18000)) * 0.05;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        if (clickStrength > 0) {
          const dx = p.x - click.x;
          const dy = p.y - click.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 40000) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / 200) * clickStrength * 1.4;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        const damping = driftCalm ? 0.94 : 0.965;
        p.vx *= damping;
        p.vy *= damping;

        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        else if (p.y > height + 10) p.y = -10;
      }

      if (showConnections) {
        ctx!.strokeStyle = `rgba(110, 231, 183, ${0.05 + mode * 0.06})`;
        ctx!.lineWidth = 0.4;
        for (let i = 0; i < particles.length; i += 1) {
          const a = particles[i];
          for (let j = i + 1; j < particles.length; j += 1) {
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < connectionDistance * connectionDistance) {
              ctx!.beginPath();
              ctx!.moveTo(a.x, a.y);
              ctx!.lineTo(b.x, b.y);
              ctx!.stroke();
            }
          }
        }
      }

      const baseAlpha = driftCalm ? 0.32 : 0.4 + mode * 0.15;
      ctx!.fillStyle = `rgba(110, 231, 183, ${baseAlpha})`;
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.baseRadius * radiusScale, 0, Math.PI * 2);
        ctx!.fill();
      }

      rafId = requestAnimationFrame(frame);
    }

    let rafId = 0;

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });

    if (reducedMotion) {
      drawStaticFrame();
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="particle-field"
      data-particle-field="true"
      data-scroll-reactive-background="true"
      data-scroll-parallax="true"
      data-particle-mode="calm"
      data-particle-density="0"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(16,185,129,0.09), transparent 60%)",
            "radial-gradient(ellipse 70% 40% at 50% 100%, rgba(16,185,129,0.06), transparent 60%)",
            "linear-gradient(180deg, #000 0%, #06080a 100%)",
          ].join(", "),
        }}
      />
      <canvas
        ref={canvasRef}
        data-testid="particle-field-canvas"
        className="absolute inset-0 h-full w-full"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.78) 100%)",
        }}
      />
    </div>
  );
}
