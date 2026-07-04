// RFQ-STRATEGY-FOUNDATION-AUDIT-V1 — local payoff computation for the
// strategy builder.
//
// The math is intentional intrinsic-only: each option leg's payoff at
// expiry as a function of underlying spot, then summed across legs.
// Premium is respected when set on a leg; otherwise it defaults to 0
// and the calling UI is required to display "premium excluded" copy.
//
// No IV, no time-to-expiry, no black-scholes. That's deliberate — a
// fake continuous PnL curve would be dishonest without real quote
// data, and the audit deferred quote wiring to a follow-up milestone.

import type { StrategyLeg, StrategyState } from "./rfq-strategy-model";

const LEG_PAYOFF_EPS = 1e-9;

/**
 * Intrinsic payoff of a single leg at a given expiry spot `s`,
 * scaled by the outer strategy `amount` and the leg's `ratio`.
 */
export function legPayoffAtExpiry(
  leg: StrategyLeg,
  s: number,
  amount: number,
): number {
  const sign = leg.side === "buy" ? 1 : -1;
  const size = amount * leg.ratio;
  const intrinsic =
    leg.optionType === "call"
      ? Math.max(s - leg.strike, 0)
      : Math.max(leg.strike - s, 0);
  const paid = leg.premium ?? 0;
  return sign * size * intrinsic - sign * size * paid;
}

/** Total strategy payoff at expiry spot `s`. */
export function totalPayoffAtExpiry(state: StrategyState, s: number): number {
  let sum = 0;
  for (const leg of state.legs) sum += legPayoffAtExpiry(leg, s, state.amount);
  return sum;
}

export interface PayoffSample {
  s: number;
  pnl: number;
}

/** Build a sampled payoff curve from `sMin` to `sMax` with `n` points. */
export function samplePayoffCurve(
  state: StrategyState,
  sMin: number,
  sMax: number,
  n = 128,
): PayoffSample[] {
  if (n < 2) throw new Error("samplePayoffCurve requires n >= 2");
  const step = (sMax - sMin) / (n - 1);
  const out: PayoffSample[] = [];
  for (let i = 0; i < n; i += 1) {
    const s = sMin + step * i;
    out.push({ s, pnl: totalPayoffAtExpiry(state, s) });
  }
  return out;
}

/**
 * Anchor range for the payoff curve. Uses the min/max strike as the
 * center window and widens it by ± 40 % so the curve breathes on both
 * tails. If there are no strikes (empty custom strategy) returns a
 * safe [0, 1] range so callers still get a valid tuple.
 */
export function defaultSpotRange(state: StrategyState): {
  sMin: number;
  sMax: number;
} {
  const ks = state.legs.map((l) => l.strike).filter((k) => Number.isFinite(k) && k > 0);
  if (ks.length === 0) return { sMin: 0, sMax: 1 };
  const kMin = Math.min(...ks);
  const kMax = Math.max(...ks);
  const center = (kMin + kMax) / 2;
  const halfSpan = Math.max((kMax - kMin) / 2, center * 0.1);
  const pad = halfSpan * 1.4;
  const sMin = Math.max(0, center - pad);
  const sMax = center + pad;
  return { sMin, sMax };
}

export interface PayoffMetrics {
  /** Highest PnL point on the sampled range. May be `+Infinity` if
   *  the strategy has an uncapped long leg beyond the sample window. */
  maxProfit: number;
  /** Lowest PnL point on the sampled range. May be `-Infinity`. */
  maxLoss: number;
  /** Spot prices where the sampled curve crosses zero (best-effort
   *  linear interpolation between adjacent samples). */
  breakEvens: number[];
  /** True if any leg has `premium == null` — in that case the
   *  metrics ignore option premium and the UI must say so. */
  premiumExcluded: boolean;
}

/** Compute headline metrics for a sampled payoff curve. */
export function payoffMetrics(
  state: StrategyState,
  samples: PayoffSample[],
): PayoffMetrics {
  const premiumExcluded = state.legs.some((l) => l.premium === null);
  if (samples.length === 0) {
    return {
      maxProfit: 0,
      maxLoss: 0,
      breakEvens: [],
      premiumExcluded,
    };
  }
  let maxProfit = -Infinity;
  let maxLoss = Infinity;
  const breakEvens: number[] = [];
  for (let i = 0; i < samples.length; i += 1) {
    const p = samples[i].pnl;
    if (p > maxProfit) maxProfit = p;
    if (p < maxLoss) maxLoss = p;
    if (i > 0) {
      const prev = samples[i - 1];
      const cur = samples[i];
      if (Math.sign(prev.pnl) !== Math.sign(cur.pnl) && Math.abs(cur.pnl - prev.pnl) > LEG_PAYOFF_EPS) {
        const t = prev.pnl / (prev.pnl - cur.pnl);
        breakEvens.push(prev.s + t * (cur.s - prev.s));
      }
    }
  }
  return { maxProfit, maxLoss, breakEvens, premiumExcluded };
}

/** JSON export for the "Copy Strategy" button. Includes only public
 *  data — no wallet, no auth, no PII. */
export function strategyToJson(state: StrategyState): string {
  return JSON.stringify(
    {
      version: "rfq-strategy-foundation-v1",
      underlying: state.underlying,
      expiry_ms: state.expiryMs,
      expiry_iso: new Date(state.expiryMs).toISOString(),
      amount: state.amount,
      preset: state.presetId,
      legs: state.legs.map((l) => ({
        instrument_type: l.instrumentType,
        option_type: l.optionType,
        side: l.side,
        strike: l.strike,
        ratio: l.ratio,
        premium: l.premium,
      })),
      note:
        "Local strategy draft. RFQ creation is not live yet; this JSON is a copyable summary.",
    },
    null,
    2,
  );
}
