// OPTIONS-ADVANCED-ORDER-TICKET-UX-V1 — shared price scaling helpers.
//
// The backend stores all Options prices as u128 stringified integers
// scaled by 1e8 (the project convention). Legacy ticket UIs exposed
// those raw strings directly (e.g. `"1500000000"` for $15), which is
// developer-facing and confusing to operators.
//
// These helpers give the ticket UIs a single, deterministic way to
// go between human decimals (`"189.1"`, `"0.01"`, `"15"`) and their
// 1e8-scaled wire form (`"18910000000"`, `"1000000"`, `"1500000000"`).
//
// Rules the helpers enforce:
//
//   * String in / string out — never floats.
//   * `humanToScaled1e8` returns `null` on invalid input (empty,
//     signs, exponents, non-digits other than a single `.`, or more
//     than 8 fractional digits). The caller renders a per-field
//     validation error; no throws.
//   * `scaled1e8ToHuman` returns the input verbatim when it isn't
//     a valid non-negative integer string, so display never crashes
//     on unexpected server payloads.
//   * Neither helper reads process.env, DOM, or any wallet state.
//
// The node contract at `tests/node/price-scaling.contract.mjs` freezes
// the canonical cases the milestone brief calls out:
//   * `$189.1` → `"18910000000"`
//   * `"15000000000"` → `$150`
//   * `$0.01` → `"1000000"`

const ONE_E8 = BigInt("100000000");

/**
 * Parse a human-readable price like `"189.1"`, `"15"`, or `"0.01"`
 * into its 1e8-scaled string form. Returns `null` when the input is
 * empty, negative, non-decimal, or carries more than 8 fractional
 * digits (higher precision than the on-wire scale can represent).
 *
 * Leading + trailing whitespace is tolerated. A leading `+` or `-`
 * sign is rejected (prices are non-negative). Scientific notation
 * (`1e2`) is rejected — the ticket only accepts plain decimals.
 */
export function humanToScaled1e8(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 8) return null;
  const padded = (frac + "00000000").slice(0, 8);
  let scaled: bigint;
  try {
    scaled = BigInt(whole) * ONE_E8 + BigInt(padded || "0");
  } catch {
    return null;
  }
  if (scaled < BigInt(0)) return null;
  return scaled.toString();
}

/**
 * Format a 1e8-scaled integer string as a human-readable decimal
 * with trailing zeros trimmed (`"1500000000"` → `"15"`,
 * `"18910000000"` → `"189.1"`, `"1000000"` → `"0.01"`). Returns the
 * input verbatim when it isn't a non-negative digit-only string, so
 * unexpected server payloads never crash the render.
 */
export function scaled1e8ToHuman(scaled: string): string {
  const trimmed = scaled.trim();
  if (!/^\d+$/.test(trimmed)) return scaled;
  let big: bigint;
  try {
    big = BigInt(trimmed);
  } catch {
    return scaled;
  }
  const whole = big / ONE_E8;
  const remainder = big % ONE_E8;
  if (remainder === BigInt(0)) return whole.toString();
  const frac = remainder.toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole.toString()}.${frac}`;
}
