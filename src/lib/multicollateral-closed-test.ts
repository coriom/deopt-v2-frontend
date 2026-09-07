// DEOPT_WETH_COLLATERAL_CLOSED_TEST_V1 Part J — frontend
// closed-test opt-in gate + helpers.
//
// The production frontend behaviour is UNCHANGED: the only
// depositable / withdrawable collateral is USDC, and no WETH deposit
// controls appear on any page.
//
// A closed-test / local-dev operator can opt in via:
//
//     NEXT_PUBLIC_MULTICOLLATERAL_CLOSED_TEST_ENABLED=true
//
// which flips `isMulticollateralClosedTestEnabled()` to `true`.
// Deposit / withdraw controls for any non-USDC balance row are
// then rendered — BUT only when the backend has ALSO returned
// `is_deposit_enabled=true` / `is_withdrawal_enabled=true` for the
// specific row. The frontend never guesses; the backend is the
// authoritative gate.
//
// This dual gate (frontend env + per-row backend flag) prevents:
//   * A misconfigured production build accidentally showing WETH
//     deposits (the env flag defaults to false in production).
//   * A stale backend response after the operator disables WETH
//     mid-session (the per-row flag flips to false immediately).
//
// Byte-frozen wire contract is not affected — this module only
// reads flags, never mutates the signing path.

import type { Balance } from "./trading-types";

/** Env var name — kept in sync with backend `CLOSED_TEST_ENV_VAR`. */
export const CLOSED_TEST_ENV_VAR =
  "NEXT_PUBLIC_MULTICOLLATERAL_CLOSED_TEST_ENABLED" as const;

/**
 * Returns `true` iff the closed-test multi-collateral overlay is
 * active for this build. Truthy values: `"true"`, `"1"`, `"yes"`
 * (case-insensitive). Any other value (or unset) → `false`.
 *
 * Reads `process.env` at call time so SSR + client builds see the
 * same value. Never throws.
 */
export function isMulticollateralClosedTestEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const raw = process.env[CLOSED_TEST_ENV_VAR];
  if (raw == null) return false;
  const normalised = String(raw).trim().toLowerCase();
  return normalised === "true" || normalised === "1" || normalised === "yes";
}

/**
 * Decide whether a given `Balance` row should be RENDERED at all.
 * Rules:
 *   * USDC: always rendered (V1 default collateral).
 *   * Non-USDC: rendered iff the closed-test flag is enabled AND
 *     the backend has flagged the row as deposit- OR withdrawal-
 *     enabled (a paused-both row is hidden even in closed-test
 *     mode — the operator paused it, don't confuse the user).
 */
export function shouldRenderBalanceRow(balance: Balance): boolean {
  const sym = (balance.symbol ?? "").toUpperCase();
  if (sym === "USDC") return true;
  if (!isMulticollateralClosedTestEnabled()) return false;
  return (
    balance.is_deposit_enabled === true ||
    balance.is_withdrawal_enabled === true
  );
}

/**
 * Decide whether the deposit control for a given `Balance` row
 * should be EXPOSED. Fail-closed:
 *   * The closed-test env flag must be true (or the row is USDC).
 *   * The backend must have flagged `is_deposit_enabled === true`
 *     for the specific row.
 *
 * USDC follows the classic V1 rule: `is_collateral_active` OR
 * `is_deposit_enabled` accepted for backwards compatibility.
 */
export function shouldExposeDeposit(balance: Balance): boolean {
  const sym = (balance.symbol ?? "").toUpperCase();
  if (sym === "USDC") {
    return (
      balance.is_deposit_enabled !== false &&
      balance.is_collateral_active !== false
    );
  }
  if (!isMulticollateralClosedTestEnabled()) return false;
  return balance.is_deposit_enabled === true;
}

/**
 * Same as `shouldExposeDeposit` for the withdraw control. Kept
 * separate because deposit / withdrawal enablement are independent
 * per the vault design (an incident may freeze deposits while
 * leaving withdrawals open).
 */
export function shouldExposeWithdraw(balance: Balance): boolean {
  const sym = (balance.symbol ?? "").toUpperCase();
  if (sym === "USDC") {
    return balance.is_withdrawal_enabled !== false;
  }
  if (!isMulticollateralClosedTestEnabled()) return false;
  return balance.is_withdrawal_enabled === true;
}
