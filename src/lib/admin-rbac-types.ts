// V2G-W2 — typed mirror of the backend `AdminRole` enum + auth-mode
// enum. The frontend SHOULD NOT enforce auth from these alone (the
// security boundary is the backend middleware introduced in V2G-W2).
// These types exist so SSR / middleware code (V2G-W3) can:
//
// - Resolve required role per route the same way the backend does.
// - Hide UI affordances the caller isn't authorised for as a UX
//   nicety.
// - Type-check against the backend's response shape when JWT mode
//   lands.
//
// SECURITY INVARIANTS (do not change without updating the V2G-V threat
// model + V2G-W2 backend gate):
//   * No backend admin token / JWT ever lives in the browser. The
//     SSR proxy at `/api/admin/*` (V2G-W3) holds the secret.
//   * Higher-authority roles imply lower-authority access: see
//     `roleImplies(granted, required)`.
//   * Adding a new role here without also adding it in the backend
//     `AdminRole` enum is a security regression. Keep the two in
//     lockstep.

export const ADMIN_ROLES = [
  "viewer",
  "operator",
  "governance-admin",
  "breakglass",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

const ROLE_ORDER: Record<AdminRole, number> = {
  viewer: 0,
  operator: 1,
  "governance-admin": 2,
  breakglass: 3,
};

/**
 * `true` when the `granted` role grants at least the authority of
 * `required`. Mirrors the backend's `AdminRole::implies`.
 *
 * Authority order: viewer < operator < governance-admin < breakglass.
 */
export function roleImplies(granted: AdminRole, required: AdminRole): boolean {
  return ROLE_ORDER[granted] >= ROLE_ORDER[required];
}

/**
 * Required role lookup for backend `/admin/*` routes. Mirrors the
 * backend `required_role_for(method, path)` function 1:1. Used by the
 * SSR proxy (V2G-W3) to short-circuit reject before forwarding, and
 * by the dashboard to gate UI affordances client-side.
 *
 * Any backend route not listed here defaults to `viewer` (the safest
 * reading for a read-only admin surface). Adding a mutating route
 * MUST be reflected here.
 */
export function requiredRoleFor(method: string, path: string): AdminRole {
  const m = method.toUpperCase();
  if (
    (m === "POST" && path === "/admin/options/events/tick") ||
    (m === "POST" && path === "/admin/options/reconciliations/tick") ||
    (m === "GET" && path === "/admin/fees/v2/smoke/readiness")
  ) {
    return "operator";
  }
  return "viewer";
}

/**
 * Auth mode the backend reports. The frontend never SETS this; it
 * only DISPLAYS it. The backend's middleware honours the configured
 * mode regardless of what the frontend believes.
 */
export const ADMIN_AUTH_MODES = ["shared-token", "jwt", "disabled"] as const;

export type AdminAuthMode = (typeof ADMIN_AUTH_MODES)[number];

/**
 * Operator-mode UI panels are gated behind this consent flag in
 * addition to the role check. V2G-W3 stores it server-side (per
 * SSR session); V2G-W2 stores it in sessionStorage as a UX nicety
 * only — the backend middleware is the only authoritative gate.
 */
export const OPERATOR_MODE_SESSION_KEY = "deopt.operatorMode";

/**
 * Resolved identity surface for SSR / UI consumers. The principal
 * `name` is opaque (e.g. an OIDC `sub` claim, or the literal
 * `"shared-token"` under V2G-W1 SharedToken mode). NEVER persist
 * this to localStorage — sessionStorage at most, and prefer the
 * SSR proxy session.
 */
export type AdminIdentity = {
  name: string;
  role: AdminRole;
  authMode: AdminAuthMode;
};
