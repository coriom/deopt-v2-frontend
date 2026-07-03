// PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — shared formatters.
//
// Every number that arrives from the backend is a decimal string
// (potentially signed) at some fixed scale — 1e8 for quote/base
// values, 1e18 for the on-chain cumulative funding rate. We format
// via BigInt to avoid floating-point drift on large positions.
//
// All helpers return `"—"` for null/undefined/malformed inputs so
// the UI never renders a fabricated number.

const SCALE_1E8 = BigInt(100_000_000);
const SCALE_1E18 = BigInt(1_000_000_000_000_000_000);
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

function isSignedDecimalDigits(s: string): boolean {
  return /^-?\d+$/.test(s);
}

/**
 * Format a signed 1e8-scaled integer as a "1,234.56"-style string.
 * Returns `"—"` for null/undefined/malformed inputs.
 */
export function formatSigned1e8(
  raw: string | null | undefined,
  fractionDigits = 2,
): string {
  if (raw === null || raw === undefined) return "—";
  if (!isSignedDecimalDigits(raw)) return "—";
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  if (digits.length > 40) return raw;
  const asBigInt = BigInt(digits);
  const whole = asBigInt / SCALE_1E8;
  const frac = asBigInt % SCALE_1E8;
  const div = BigInt(10) ** BigInt(8 - fractionDigits);
  const fracStr = (frac / div).toString().padStart(fractionDigits, "0");
  const wholeStr = whole.toString().replace(THOUSANDS, ",");
  return `${negative ? "-" : ""}${wholeStr}${fractionDigits > 0 ? `.${fracStr}` : ""}`;
}

/**
 * Format a signed 1e18-scaled integer (used for cumulative funding
 * indices/deltas). Uses 6 fraction digits — enough for typical
 * per-interval funding rates. `"—"` on malformed input.
 */
export function formatSigned1e18(
  raw: string | null | undefined,
  fractionDigits = 6,
): string {
  if (raw === null || raw === undefined) return "—";
  if (!isSignedDecimalDigits(raw)) return "—";
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  if (digits.length > 50) return raw;
  const asBigInt = BigInt(digits);
  const whole = asBigInt / SCALE_1E18;
  const frac = asBigInt % SCALE_1E18;
  const div = BigInt(10) ** BigInt(18 - fractionDigits);
  const fracStr = (frac / div).toString().padStart(fractionDigits, "0");
  const wholeStr = whole.toString().replace(THOUSANDS, ",");
  return `${negative ? "-" : ""}${wholeStr}${fractionDigits > 0 ? `.${fracStr}` : ""}`;
}

/**
 * Format an unsigned bps value ("500" → "5.00%"). `"—"` on malformed.
 */
export function formatBps(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "—";
  if (!/^\d+$/.test(raw)) return "—";
  const asNumber = Number(BigInt(raw));
  if (!Number.isFinite(asNumber)) return "—";
  return `${(asNumber / 100).toFixed(2)}%`;
}

/** ISO time-only "HH:MM:SS" of an epoch-ms number. `"—"` on invalid. */
export function formatTimeOfDay(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toISOString().slice(11, 19);
}
