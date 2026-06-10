# MAINNET-AUDIT-EXT — Frontend / Admin Scope (FINAL)

**Posture:** read-only. **No chain mutation. No mainnet. No secrets.**
Companion to `~/DEOPT/deopt-v2-sol/docs/MAINNET_AUDIT_EXT_KICKOFF_FINAL.md`.

**Date:** 2026-06-10
**Anchor commit:** `5bc85c3` (`deopt-v2-frontend/`)
**Stack:** Next.js (app router) + TypeScript + Tailwind. Server components +
client components. No `wagmi` / `viem` / `ethers` / `@web3modal/*` in admin path.

## 1. Admin dashboard surfaces

### 1.1 Top-level admin pages

| Route | Purpose | Component |
|---|---|---|
| `/admin` | Admin dashboard root | `src/app/admin/admin-dashboard.tsx` |
| `/admin/production-readiness` | Production readiness section | `src/app/admin/production-readiness-section.tsx` |
| `/admin/options` | Option lifecycle | per `ADMIN_OPTION_LIFECYCLE_VIEW_V2A.md` |
| `/admin/fees` | Fee observability | per `ADMIN_V2_FEE_OBSERVABILITY_UI_V2G_U.md` |
| `/admin/executor` | Executor health visibility | per `EXECUTOR_HEALTH_ENDPOINT_V2_RESULT.md` consumption |

### 1.2 Read-only sections

- Executor health (`GET /executor/health/v2` consumption).
- Transaction visibility (`GET /executor/transactions/by-intent/{id}` + `GET /executor/transactions/list`).
- Option lifecycle view.
- Fee observability (PFV / FM_V2 read-only).

### 1.3 Write sections (require RBAC)

- Pause / unpause toggles (currently advisory; chain-side requires Safe tx).
- Operator-driven admin operations (refresh caches, force-revalidate).
- Manifest fill verification (admin reads from production manifest — read-only at launch).

## 2. Executor health consumption

Implementation: `src/lib/admin-api.ts` → `/executor/health/v2`. The dashboard's
"signer status" + "live provider config" + "R5 drift" + "intent tracking"
panels read directly from the JSON payload defined in
`MAINNET_AUDIT_BACKEND_SCOPE_FINAL.md §5`. Rendered colour-state:

- GREEN: `overall_status == "ok"`.
- YELLOW: `overall_status == "degraded"`.
- RED: `overall_status == "unhealthy"` or `signer.local_signer_on_mainnet_refused_total > 0` or `r5.drift_observed_total > 0` or `intent_tracking.not_tracked_yet[]` non-empty.

## 3. Transaction visibility endpoints (consumed)

The dashboard's "recent transactions" panel reads:

- `GET /executor/transactions/by-intent/{intent_id}` for intent-anchored drill-down.
- `GET /executor/transactions/list` for global filtered listings (filters: chain, status, intent kind, age).

## 4. SSR / proxy / RBAC assumptions

### 4.1 Current posture (engagement-kickoff commit)

- Browser-side `sessionStorage["deopt.adminToken"]` holds the admin Bearer token.
- `src/lib/admin-api.ts` injects `X-Admin-Token` header.
- No SSR proxy; admin frontend talks directly to backend admin endpoints.
- No OIDC / MFA.
- No Strict CSP.

**This is the F-H1 mainnet blocker.** See `INTERNAL_AUDIT_FINDINGS_V2G_AUDIT0.md`
(frontend section).

### 4.2 Target posture (V2G-W3 SSR proxy closure)

- Admin frontend talks to SSR proxy host (no direct backend access).
- SSR proxy exchanges OIDC id-token + MFA assertion for backend Bearer token (server-side).
- Admin token NEVER stored in browser.
- Strict CSP: `default-src 'self'`; no `'unsafe-inline'`; no `'unsafe-eval'`;
  `connect-src 'self'` (proxy host).
- `dangerouslySetInnerHTML` MUST remain absent under CI gate.
- `wagmi` / `viem` / `ethers` / `@web3modal/*` MUST remain absent under CI gate.

Spec: `ADMIN_FRONTEND_AUTH_PROXY_V2G_W2.md` + roadmap `FRONTEND-V2G-W3-SSR-PROXY`.

## 5. Dangerous admin operations

Operations that MUST be RBAC-gated + audit-logged + double-confirmed:

- Pause / unpause OME / PFV / FM_V2 (advisory; chain-side requires Safe tx, but the frontend MUST refuse to surface "pause" without operator RBAC).
- Manifest-fill verification (refresh manifest; advisory).
- Refresh cache (`effective_ppm_cache`).
- Force re-poll signer health.
- Force re-poll live provider config.

Operations that MUST never be exposed in the admin surface:

- Direct signer-side actions (sign / get-public-key); admin NEVER touches signer.
- `EXECUTOR_PRIVATE_KEY` reading / display.
- AWS credentials reading / display.
- KMS key id / KMS ARN display (operator runs from OFFLINE_BINDER; UI does not need these).
- Mainnet private RPC URL display.
- Database connection string display.

## 6. Expected read-only vs write actions

| Section | Action | RBAC required |
|---|---|---|
| Executor health | read | viewer |
| Transaction visibility | read | viewer |
| Option lifecycle | read | viewer |
| Fee observability | read | viewer |
| Manifest fill verification | read | viewer |
| Refresh cache | write | operator |
| Force re-poll | write | operator |
| Pause / unpause advisory | write | admin |
| Manifest-fill edit | NOT EXPOSED | n/a |
| Signer-side actions | NOT EXPOSED | n/a |

## 7. Frontend launch blockers

| Id | Description | Severity | Closure |
|---|---|---|---|
| F-H1 | Admin token in browser sessionStorage | High → mainnet blocker | V2G-W3 SSR proxy + OIDC/MFA |
| F-M1 | `STATIC_FACTS` stale post-V2G-P / V2G-RX | Medium | Refresh + auto-revalidate against backend |
| F-L1 | RBAC types not consumed by live UI | Low | Wire `src/lib/admin-rbac-types.ts` to render gating |

## 8. Open hardening tasks

- Strict CSP gate at CI (header check at build).
- OIDC / MFA enforcement at SSR proxy.
- Admin token rotation policy (refresh every N hours).
- Audit log surface (every admin action → audit endpoint).
- Force-revalidate hooks for `STATIC_FACTS`.
- Cardinality-safe admin-side metrics (reuse backend `/metrics`).
- Frontend dependency lockdown CI: `wagmi` / `viem` / `ethers` / `@web3modal/*` MUST be absent under CI guard.
- `dangerouslySetInnerHTML` MUST be absent under CI guard.
- Verify `Cookie` / `Set-Cookie` SSR posture: `Secure`, `HttpOnly`, `SameSite=Strict`.

## 9. Open auditor questions on frontend scope

- **FQ-1** Does the SSR proxy + OIDC/MFA + Strict CSP target posture satisfy the auditor's mainnet admin-surface bar, or does the auditor recommend additional controls (e.g. signed-request envelopes, time-bounded session tokens)?
- **FQ-2** Are the absence-of-dependency CI guards (`wagmi` / `viem` / `ethers` / `@web3modal/*` MUST be absent from `src/app/admin/**`) sufficient to prevent accidental on-chain admin paths, or does the auditor recommend an allowlist guard at module-resolution?
- **FQ-3** Is the admin RBAC model (viewer / operator / admin) appropriate for an early-mainnet posture, or does the auditor recommend a finer-grained role split?
- **FQ-4** Is the proposed `STATIC_FACTS` refresh model (force-revalidate against backend) safe against a backend compromise, or does the auditor recommend chain-side verification on every render?
- **FQ-5** Does the operator's plan to keep the admin frontend as a thin read-mostly surface (no chain tx send) need additional documentation / CI guards to prevent regression?

## 10. Cross-links

- `~/DEOPT/deopt-v2-sol/docs/MAINNET_AUDIT_EXT_KICKOFF_FINAL.md` — kickoff finalisation
- `~/DEOPT/deopt-v2-sol/docs/MAINNET_AUDIT_CONTRACT_SCOPE_FINAL.md` — contract scope
- `~/DEOPT/deopt-v2-backend/docs/MAINNET_AUDIT_BACKEND_SCOPE_FINAL.md` — backend scope
- `~/DEOPT/deopt-v2-sol/docs/MAINNET_AUDIT_RISK_REGISTER_FINAL.md` — risk register
- `ADMIN_FRONTEND_AUTH_PROXY_V2G_W2.md`
- `ADMIN_AUTH_RBAC_UI_NOTES_V2G_V.md`
- `ADMIN_OPTION_LIFECYCLE_VIEW_V2A.md`
- `ADMIN_V2_FEE_OBSERVABILITY_UI_V2G_U.md`
- `INTERNAL_AUDIT_FINDINGS_V2G_AUDIT0.md`
- `~/DEOPT/deopt-v2-backend/docs/EXECUTOR_HEALTH_ENDPOINT_V2_RESULT.md`

**End of mainnet audit frontend / admin scope (FINAL).**
