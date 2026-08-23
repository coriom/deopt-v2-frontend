// Global UI brightness preference — pure config (no React).
//
// The slider is 0–100 % (linear). 50 % is the identity — the app
// looks exactly as it does with no filter applied. 0 % dims to
// brightness(0.5), 100 % boosts to brightness(1.5); the range is
// deliberately conservative so extremes stay readable.

export const MIN_BRIGHTNESS_PCT = 0;
export const MAX_BRIGHTNESS_PCT = 100;
export const DEFAULT_BRIGHTNESS_PCT = 50;
export const BRIGHTNESS_STORAGE_KEY = "deopt:brightness";

export function clampBrightness(pct: number): number {
  if (!Number.isFinite(pct)) return DEFAULT_BRIGHTNESS_PCT;
  const rounded = Math.round(pct);
  if (rounded < MIN_BRIGHTNESS_PCT) return MIN_BRIGHTNESS_PCT;
  if (rounded > MAX_BRIGHTNESS_PCT) return MAX_BRIGHTNESS_PCT;
  return rounded;
}

/** Map 0–100 % to the CSS `filter: brightness(...)` value applied on
 *  <html>. 50 → 1.0 (identity). NOTE: kept in sync with the inline
 *  hydration script in `src/app/layout.tsx` (which cannot import ES
 *  modules). If the range changes, update both places. */
export function brightnessPctToFilter(pct: number): string {
  const clamped = clampBrightness(pct);
  const factor = 0.5 + clamped / 100;
  return `brightness(${factor.toFixed(3)})`;
}
