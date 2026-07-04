// Options-chain row model.
//
// Normalises a product + its series into a strike-ladder view that
// the terminal grid can render with calls on the left, strike in the
// center, puts on the right. The backend exposes products as
// {is_call} per product + a list of `series_ids`; for the terminal
// we want strike-paired rows so we group across the call-product and
// the matching put-product at the same expiry + same strike.
//
// Honest defaults: bid / ask / mark / iv / Greeks are NOT available
// in the public testnet beta backend today. Each field carries an
// explicit "available" flag so the grid can render "—" instead of
// inventing values. Do not fake liquidity; do not fake Greeks.

import type {
  DecimalString,
  Product,
  Series,
  SeriesId,
} from "@/lib/trading-types";
import { underlyingDisplaySymbol } from "@/lib/underlying-symbols";

export type OptionAvail = "live" | "n/a-testnet" | "loading";

export interface OptionLeg {
  seriesId: SeriesId | null;
  productId: string | null;
  isCall: boolean;
  /** Bid, if backend has it. Otherwise null with `bidAvail`. */
  bid: DecimalString | null;
  bidAvail: OptionAvail;
  ask: DecimalString | null;
  askAvail: OptionAvail;
  /** Mark / mid (1e8 string). */
  mark1e8: DecimalString | null;
  markAvail: OptionAvail;
  /** Last fill premium, if backend has it. */
  lastPremium: DecimalString | null;
  lastPremiumAvail: OptionAvail;
  /** Greeks — always "n/a-testnet" until backend exposes them. */
  iv: number | null;
  ivAvail: OptionAvail;
  delta: number | null;
  deltaAvail: OptionAvail;
  gamma: number | null;
  gammaAvail: OptionAvail;
  vega: number | null;
  vegaAvail: OptionAvail;
  theta: number | null;
  thetaAvail: OptionAvail;
}

export interface OptionsChainRow {
  /** Strike normalised to 1e8 string. */
  strike1e8: DecimalString;
  /** Expiry timestamp (ms). Same for call + put at this row. */
  expiryMs: number;
  /** Display label for the strike (best-effort numeric format). */
  strikeLabel: string;
  /** Display label for the expiry (YYYY-MM-DD). */
  expiryLabel: string;
  /** Whether this row is in-the-money vs the current spot, if known. */
  itm: "call" | "put" | null;
  call: OptionLeg;
  put: OptionLeg;
}

export interface UnavailableLeg {
  reason: "no-product" | "no-series" | "testnet-warmup";
}

function emptyLeg(isCall: boolean): OptionLeg {
  const NA: OptionAvail = "n/a-testnet";
  return {
    seriesId: null,
    productId: null,
    isCall,
    bid: null,
    bidAvail: NA,
    ask: null,
    askAvail: NA,
    mark1e8: null,
    markAvail: NA,
    lastPremium: null,
    lastPremiumAvail: NA,
    iv: null,
    ivAvail: NA,
    delta: null,
    deltaAvail: NA,
    gamma: null,
    gammaAvail: NA,
    vega: null,
    vegaAvail: NA,
    theta: null,
    thetaAvail: NA,
  };
}

function formatStrike1e8(s: DecimalString): string {
  try {
    const big = BigInt(s);
    const ONE_E_8 = BigInt(100_000_000);
    const ZERO = BigInt(0);
    const whole = big / ONE_E_8;
    const frac = big % ONE_E_8;
    return frac === ZERO
      ? whole.toString()
      : `${whole.toString()}.${frac
          .toString()
          .padStart(8, "0")
          .replace(/0+$/, "")}`;
  } catch {
    return s;
  }
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Build a chain row for a single (strike, expiry) cell from already-
 * resolved series.
 */
function legFromSeries(s: Series | null): OptionLeg {
  if (!s) return emptyLeg(false);
  const NA: OptionAvail = "n/a-testnet";
  return {
    seriesId: s.series_id,
    productId: s.product_id,
    isCall: s.is_call,
    bid: null,
    bidAvail: NA,
    ask: null,
    askAvail: NA,
    mark1e8: null,
    markAvail: NA,
    lastPremium: null,
    lastPremiumAvail: NA,
    iv: null,
    ivAvail: NA,
    delta: null,
    deltaAvail: NA,
    gamma: null,
    gammaAvail: NA,
    vega: null,
    vegaAvail: NA,
    theta: null,
    thetaAvail: NA,
  };
}

/**
 * Public API: assemble chain rows from a product list + per-series
 * detail map. The terminal calls this once per render; the result is
 * stable for a given input.
 *
 * `seriesById` is populated by the terminal as it batches series
 * details via `useProductBatch` + `useSeriesDetails`. Series that
 * haven't loaded yet are treated as null legs ("loading" rendered).
 */
export function buildOptionsChain(
  underlyingProducts: Product[],
  seriesById: Map<SeriesId, Series>,
): OptionsChainRow[] {
  // Group strike + expiry across the call-product and put-product for
  // the same underlying.
  const rowKey = (strike1e8: DecimalString, expiryMs: number) =>
    `${strike1e8}::${expiryMs}`;
  const rows: Map<string, OptionsChainRow> = new Map();

  // First pass: gather all series referenced by the products.
  const seriesIdsFromProducts = new Set<SeriesId>();
  for (const product of underlyingProducts) {
    for (const sid of (product as { series_ids?: SeriesId[] }).series_ids ??
      []) {
      seriesIdsFromProducts.add(sid);
    }
  }

  // Resolve series — only those already known via seriesById.
  for (const sid of seriesIdsFromProducts) {
    const s = seriesById.get(sid);
    if (!s) continue;
    const key = rowKey(s.strike_1e8, s.expiry_ms);
    let row = rows.get(key);
    if (!row) {
      row = {
        strike1e8: s.strike_1e8,
        expiryMs: s.expiry_ms,
        strikeLabel: formatStrike1e8(s.strike_1e8),
        expiryLabel: isoDate(s.expiry_ms),
        itm: null,
        call: emptyLeg(true),
        put: emptyLeg(false),
      };
      rows.set(key, row);
    }
    if (s.is_call) {
      row.call = legFromSeries(s);
    } else {
      row.put = legFromSeries(s);
    }
  }

  // Sort: ascending strike then expiry.
  const out = [...rows.values()];
  out.sort((a, b) => {
    const aS = BigInt(a.strike1e8);
    const bS = BigInt(b.strike1e8);
    if (aS < bS) return -1;
    if (aS > bS) return 1;
    return a.expiryMs - b.expiryMs;
  });
  return out;
}

/**
 * Filter chain rows by an expiry pick. If `expiryMs` is null, returns
 * all rows.
 */
export function filterByExpiry(
  rows: OptionsChainRow[],
  expiryMs: number | null,
): OptionsChainRow[] {
  if (expiryMs === null) return rows;
  return rows.filter((r) => r.expiryMs === expiryMs);
}

/**
 * List distinct expiries from a chain.
 */
export function distinctExpiries(
  rows: OptionsChainRow[],
): Array<{ ms: number; label: string }> {
  const seen = new Map<number, string>();
  for (const r of rows) {
    if (!seen.has(r.expiryMs)) seen.set(r.expiryMs, r.expiryLabel);
  }
  return [...seen.entries()]
    .map(([ms, label]) => ({ ms, label }))
    .sort((a, b) => a.ms - b.ms);
}

/** Distinct underlying symbols from a product list.
 *
 * `key` is the raw underlying identifier the backend uses (usually a
 * hex address) so filtering + backend calls stay stable; `label` is
 * the human-readable ticker resolved via `underlyingDisplaySymbol` —
 * uses the backend-provided `underlying_symbol` when present, then a
 * frozen Base-Sepolia address table, then a truncated `0xABCD…6789`,
 * then the raw value.
 */
export function distinctUnderlyings(
  products: Product[],
): Array<{ key: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ key: string; label: string }> = [];
  for (const p of products) {
    const key = p.underlying;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      label: underlyingDisplaySymbol(p.underlying, p.underlying_symbol),
    });
  }
  return out;
}
