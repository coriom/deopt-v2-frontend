// RFQ-STRATEGY-FOUNDATION-AUDIT-V1 — typed model for the strategy
// builder page. Frontend-only for now: no backend mutation, no RFQ
// create call. The backend supports Options RFQ end-to-end (see
// `/options/rfqs*` in `deopt-v2-backend/src/api/routes.rs`) but the
// audit deferred the wiring to a follow-up milestone:
// `OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1`.

export type OptionType = "call" | "put";
export type LegSide = "buy" | "sell";
export type StrategyUnderlying = "BTC" | "ETH";

export interface StrategyLeg {
  /** Stable client-side id — regenerated per preset change. */
  id: string;
  /** V1 is single-instrument-type. Perps RFQ stays fail-closed. */
  instrumentType: "option";
  optionType: OptionType;
  side: LegSide;
  /** Strike as a plain number in the underlying's quote currency (USDC). */
  strike: number;
  /** Contract count. */
  ratio: number;
  /** Optional per-leg premium in quote currency. Defaults to `null` —
   *  the payoff explicitly labels this as "premium excluded" so we
   *  never claim a fake PnL against live quote data. */
  premium: number | null;
}

export type StrategyPresetId =
  | "call"
  | "put"
  | "call-spread"
  | "put-spread"
  | "risk-reversal"
  | "butterfly"
  | "straddle"
  | "strangle"
  | "custom";

export interface StrategyPresetDef {
  id: StrategyPresetId;
  label: string;
  /** One-line description shown in the leg editor toolbar. */
  description: string;
  /** Build the seed legs from an ATM-ish anchor price. Amount is not
   *  factored in — that's the outer strategy `amount`. */
  seedLegs: (anchor: number) => Omit<StrategyLeg, "id">[];
}

// Round to the nearest whole strike step (defaults to 500 for BTC-ish
// prices). Kept public so the tests can pin the exact rounded values.
export function roundStrike(anchor: number, step = 500): number {
  return Math.max(step, Math.round(anchor / step) * step);
}

function optionLeg(
  optionType: OptionType,
  side: LegSide,
  strike: number,
  ratio = 1,
): Omit<StrategyLeg, "id"> {
  return {
    instrumentType: "option",
    optionType,
    side,
    strike,
    ratio,
    premium: null,
  };
}

export const STRATEGY_PRESETS: StrategyPresetDef[] = [
  {
    id: "call",
    label: "Call",
    description: "Long call — bullish, capped downside at premium.",
    seedLegs: (a) => [optionLeg("call", "buy", roundStrike(a))],
  },
  {
    id: "put",
    label: "Put",
    description: "Long put — bearish, capped downside at premium.",
    seedLegs: (a) => [optionLeg("put", "buy", roundStrike(a))],
  },
  {
    id: "call-spread",
    label: "Call Spread",
    description: "Bull call spread — long lower strike, short higher.",
    seedLegs: (a) => {
      const k = roundStrike(a);
      return [
        optionLeg("call", "buy", k),
        optionLeg("call", "sell", k + 500),
      ];
    },
  },
  {
    id: "put-spread",
    label: "Put Spread",
    description: "Bear put spread — long higher strike, short lower.",
    seedLegs: (a) => {
      const k = roundStrike(a);
      return [
        optionLeg("put", "buy", k),
        optionLeg("put", "sell", k - 500),
      ];
    },
  },
  {
    id: "risk-reversal",
    label: "Risk Reversal",
    description: "Short lower put + long higher call.",
    seedLegs: (a) => {
      const k = roundStrike(a);
      return [
        optionLeg("put", "sell", k - 500),
        optionLeg("call", "buy", k + 500),
      ];
    },
  },
  {
    id: "butterfly",
    label: "Butterfly",
    description: "1-2-1 call butterfly around ATM.",
    seedLegs: (a) => {
      const k = roundStrike(a);
      return [
        optionLeg("call", "buy", k - 500),
        optionLeg("call", "sell", k, 2),
        optionLeg("call", "buy", k + 500),
      ];
    },
  },
  {
    id: "straddle",
    label: "Straddle",
    description: "Long call + long put at the same strike.",
    seedLegs: (a) => {
      const k = roundStrike(a);
      return [
        optionLeg("call", "buy", k),
        optionLeg("put", "buy", k),
      ];
    },
  },
  {
    id: "strangle",
    label: "Strangle",
    description: "Long OTM put + long OTM call.",
    seedLegs: (a) => {
      const k = roundStrike(a);
      return [
        optionLeg("put", "buy", k - 500),
        optionLeg("call", "buy", k + 500),
      ];
    },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Start empty; add and edit legs manually.",
    seedLegs: () => [],
  },
];

export interface StrategyState {
  underlying: StrategyUnderlying;
  /** Milliseconds since epoch. The public-beta seed uses expiry
   *  `1798704000000` (2026-12-31 UTC) — that's the default. */
  expiryMs: number;
  /** Contract multiplier applied to every leg's ratio. */
  amount: number;
  presetId: StrategyPresetId;
  legs: StrategyLeg[];
}

const DEFAULT_EXPIRY_MS = 1798704000_000; // 2026-12-31 UTC

/** Anchor strike used by presets when no market spot is available. */
const DEFAULT_ANCHOR: Record<StrategyUnderlying, number> = {
  BTC: 95_000,
  ETH: 4_000,
};

/** Build a deterministic leg id from the preset that seeded it and
 *  the leg's index in that preset. Deterministic ids keep the SSR
 *  markup byte-identical to the first client render so hydration
 *  never mismatches — a module-scoped counter used to increment
 *  differently on server vs. client (React 19 dev-mode double-
 *  invocation, Fast Refresh, cross-request module reuse), which
 *  produced `data-testid` diffs like `leg-1` vs. `leg-2`. */
function legIdFor(presetId: string, index: number): string {
  return `${presetId}-leg-${index + 1}`;
}

/**
 * Apply a preset to an existing state — resets legs, keeps
 * underlying/expiry/amount so switching presets doesn't wipe user
 * context.
 */
export function applyPreset(
  state: StrategyState,
  presetId: StrategyPresetId,
): StrategyState {
  const preset = STRATEGY_PRESETS.find((p) => p.id === presetId);
  if (!preset) return state;
  const anchor = DEFAULT_ANCHOR[state.underlying];
  const seeds = preset.seedLegs(anchor);
  return {
    ...state,
    presetId,
    legs: seeds.map((seed, i) => ({ ...seed, id: legIdFor(presetId, i) })),
  };
}

/** Initial state for a fresh page load. */
export function initialStrategyState(
  underlying: StrategyUnderlying = "BTC",
): StrategyState {
  return applyPreset(
    {
      underlying,
      expiryMs: DEFAULT_EXPIRY_MS,
      amount: 1,
      presetId: "call",
      legs: [],
    },
    "call",
  );
}

export function updateLeg(
  state: StrategyState,
  legId: string,
  patch: Partial<Omit<StrategyLeg, "id">>,
): StrategyState {
  return {
    ...state,
    legs: state.legs.map((l) => (l.id === legId ? { ...l, ...patch } : l)),
  };
}

/** Summarise the strategy into a single-line title — e.g.
 *  `BTC Strangle Dec 2026 $94500/$95500`. */
export function summariseStrategy(state: StrategyState): string {
  const preset = STRATEGY_PRESETS.find((p) => p.id === state.presetId);
  const label = preset?.label ?? "Custom";
  const expiry = new Date(state.expiryMs).toISOString().slice(0, 10);
  const strikes = state.legs
    .map((l) => l.strike)
    .filter((s) => Number.isFinite(s) && s > 0);
  const strikeSummary = strikes.length
    ? strikes
        .sort((a, b) => a - b)
        .map((s) => `$${s.toLocaleString("en-US")}`)
        .join(" / ")
    : "no strikes";
  return `${state.underlying} ${label} ${expiry} ${strikeSummary}`;
}
