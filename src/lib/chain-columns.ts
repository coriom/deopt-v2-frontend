// FRONTEND-OPTIONS-CHAIN-POLISH-V1 — column registry for the options
// chain grid. Every numeric cell is sourced from `OptionLeg` if the
// backend exposes the field; otherwise the formatter returns `null`
// which the grid renders as `—`. No fake values.

import type { OptionLeg } from "@/lib/options-chain-model";

export type ColumnId =
  | "bidSize"
  | "bidIV"
  | "bid"
  | "mark"
  | "ask"
  | "askIV"
  | "askSize"
  | "delta"
  | "markIV"
  | "vol"
  | "oi"
  | "chg"
  | "theta"
  | "vega"
  | "rho"
  | "gamma"
  | "netChange";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /**
   * Return the cell text for a leg, or `null` for the dash. The grid
   * never fabricates values; if a field is not exposed by the
   * backend the formatter returns `null` deterministically.
   */
  value: (leg: OptionLeg) => string | null;
}

function liveDecimal(
  v: string | null,
  avail: OptionLeg["bidAvail"],
): string | null {
  return v != null && avail === "live" ? v : null;
}

function pct(n: number | null, avail: OptionLeg["ivAvail"]): string | null {
  return n != null && avail === "live" ? `${n}%` : null;
}

function greek(
  n: number | null,
  avail: OptionLeg["deltaAvail"],
  digits = 3,
): string | null {
  return n != null && avail === "live" ? n.toFixed(digits) : null;
}

export const COLUMN_REGISTRY: Record<ColumnId, ColumnDef> = {
  bidSize: {
    id: "bidSize",
    label: "Bid Size",
    value: () => null, // not exposed
  },
  bidIV: {
    id: "bidIV",
    label: "Bid IV",
    value: () => null, // not exposed; only mark IV today
  },
  bid: {
    id: "bid",
    label: "Bid",
    value: (l) => liveDecimal(l.bid, l.bidAvail),
  },
  mark: {
    id: "mark",
    label: "Mark",
    value: (l) => liveDecimal(l.mark1e8, l.markAvail),
  },
  ask: {
    id: "ask",
    label: "Ask",
    value: (l) => liveDecimal(l.ask, l.askAvail),
  },
  askIV: {
    id: "askIV",
    label: "Ask IV",
    value: () => null,
  },
  askSize: {
    id: "askSize",
    label: "Ask Size",
    value: () => null,
  },
  delta: {
    id: "delta",
    label: "Δ",
    value: (l) => greek(l.delta, l.deltaAvail),
  },
  markIV: {
    id: "markIV",
    label: "Mark IV",
    value: (l) => pct(l.iv, l.ivAvail),
  },
  vol: {
    id: "vol",
    label: "Vol",
    value: () => null,
  },
  oi: {
    id: "oi",
    label: "OI",
    value: () => null,
  },
  chg: {
    id: "chg",
    label: "Chg %",
    value: () => null,
  },
  theta: {
    id: "theta",
    label: "Θ",
    value: (l) => greek(l.theta, l.thetaAvail),
  },
  vega: {
    id: "vega",
    label: "ν",
    value: (l) => greek(l.vega, l.vegaAvail),
  },
  rho: {
    id: "rho",
    label: "ρ",
    value: () => null,
  },
  gamma: {
    id: "gamma",
    label: "Γ",
    value: (l) => greek(l.gamma, l.gammaAvail, 4),
  },
  netChange: {
    id: "netChange",
    label: "24h Δ%",
    value: () => null,
  },
};

/** Canonical render order — the user can reorder freely from here. */
export const DEFAULT_ORDER: ColumnId[] = [
  "bidSize",
  "bidIV",
  "bid",
  "mark",
  "ask",
  "askIV",
  "askSize",
  "delta",
  "markIV",
  "vol",
  "oi",
  "chg",
  "theta",
  "vega",
  "rho",
  "gamma",
  "netChange",
];

/** Initial visible columns — the ones most likely to be useful on day 1. */
export const DEFAULT_VISIBLE: ColumnId[] = [
  "bid",
  "mark",
  "ask",
  "delta",
  "markIV",
];

export const ALL_COLUMN_IDS: ColumnId[] = DEFAULT_ORDER;
