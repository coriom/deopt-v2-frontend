"use client";

// Fades each landing section in as it enters the viewport.
//
// Renders nothing of its own — wraps children in a single div with
// the `deopt-section-reveal` class (defined in globals.css). On
// mount we flip `data-revealed="true"` once the element crosses 12%
// into the viewport. `prefers-reduced-motion: reduce` short-circuits
// the observer AND the underlying CSS transition.

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface Props {
  children: ReactNode;
  /** testid for the wrapping div */
  testid?: string;
  /** Extra Tailwind classes on the wrapper */
  className?: string;
}

export function SectionReveal({ children, testid, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const showImmediately = () => {
      Promise.resolve().then(() => setRevealed(true));
    };
    if (typeof IntersectionObserver === "undefined") {
      showImmediately();
      return;
    }
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      showImmediately();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-testid={testid}
      data-revealed={revealed ? "true" : "false"}
      className={`deopt-section-reveal ${className}`.trim()}
    >
      {children}
    </div>
  );
}
