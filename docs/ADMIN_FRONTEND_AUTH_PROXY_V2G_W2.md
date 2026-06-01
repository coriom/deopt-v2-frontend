# V2G-W2 — Frontend Admin Auth + Proxy Notes

Companion to `deopt-v2-backend/docs/ADMIN_RBAC_ROUTE_ENFORCEMENT_V2G_W2.md`.
Frontend-only notes for V2G-W2. **Docs + type-mirror only.** No
live middleware or proxy code in V2G-W2.

---

## Current frontend posture (V2G-U + V2G-V close)

| Surface | Behaviour |
|---|---|
| Token storage | `sessionStorage["deopt.adminToken"]` |
| Token transport | `X-Admin-Token` header injected at fetch site (`src/lib/admin-api.ts`) |
| Backend gate | Middleware (V2G-W2) + handler-side `ensure_admin_access` — both run |
| Wallet signing | none (by design) |
| Mutation buttons | none |

This is the known V2G-V T2 / T3 limitation: the backend admin secret
lives in the browser as long as the admin token (sessionStorage)
does. V2G-W3 closes this by moving the secret to the SSR layer.

---

## V2G-W2 ships

1. **`src/lib/admin-rbac-types.ts`** — typed mirror of the backend
   role model:
   - `AdminRole` literal type
     (`"viewer" | "operator" | "governance-admin" | "breakglass"`)
   - `roleImplies(granted, required)` predicate
   - `requiredRoleFor(method, path)` route lookup (1:1 with the
     backend mapping in `src/admin.rs::required_role_for`)
   - `AdminAuthMode` enum
   - `OPERATOR_MODE_SESSION_KEY` constant
   - `AdminIdentity` type for SSR consumers
2. **This doc.**

No other frontend file is touched. The existing
`<ProductionReadinessSection>` (V2G-U) does NOT yet consume
`AdminRole` — the role-gated UI affordances are V2G-W3 work once
the SSR session provides a real identity object.

---

## V2G-W3 target architecture (recap from V2G-V §3.3)

```
Browser ─ OIDC / Cloudflare Access (edge)
        │
        ▼
   Next.js /admin/*
        │
        │  middleware.ts:
        │   • verify OIDC session
        │   • mint backend JWT bound to identity + role
        │   • forward via /api/admin/* (same-origin)
        │   • write audit-log line
        │
        ▼
   /api/admin/[...path]/route.ts  ← SSR proxy
        │
        │  reads process.env.BACKEND_ADMIN_TOKEN
        │  (Server Component scope only)
        │
        ▼
   deopt-v2-backend /admin/* (JWT-verified, role-gated)
```

### Frontend invariants the V2G-W2 type module already encodes

| Invariant | Encoded by |
|---|---|
| Roles are the four backend roles, lowercase strings | `ADMIN_ROLES` tuple + `AdminRole` literal type |
| Higher-authority role implies lower | `roleImplies` |
| Per-route required role mirrors backend exactly | `requiredRoleFor(method, path)` — V2G-W3 SSR proxy uses this to short-circuit reject before forwarding |
| Auth-mode literal strings match backend | `ADMIN_AUTH_MODES` tuple |
| Operator-mode is a per-session UX flag, NEVER an auth boundary | `OPERATOR_MODE_SESSION_KEY` exported as constant; comment explicitly states the backend remains authoritative |

---

## Anti-patterns to avoid in V2G-W3 implementation

| Anti-pattern | Why |
|---|---|
| Persist the JWT to `localStorage` / `sessionStorage` | V2G-V T2 + T3. Use the SSR session cookie only. |
| Read `BACKEND_ADMIN_TOKEN` in a Client Component | Next.js bundles client-component env into the JS chunk. ONLY read inside Server Components / API routes. |
| Use `dangerouslySetInnerHTML` on backend payloads | Defeats React's auto-escaping; V2G-V T3. |
| Display the JWT or `Authorization` header value anywhere | Audit log + UI must never echo it. |
| Add an `/admin` button that calls `eth_sendTransaction` / `personal_sign` | V2G-V hard gate. Off-band signing only. |
| Make the JS-side `requiredRoleFor` the security boundary | The backend middleware is the only authoritative gate. JS-side checks are a UX nicety. |

---

## Backwards compatibility

V2G-W2 changes nothing in the running `/admin` UI:

- `src/lib/admin-api.ts` still injects `X-Admin-Token`.
- `sessionStorage["deopt.adminToken"]` still holds the token.
- `<AdminDashboard>` still renders all sections including the
  V2G-U production-readiness panel.

The new types file is unused by runtime code until V2G-W3 wires
the SSR proxy.

`npm run lint` ✅, `npx tsc --noEmit` ✅, `npm run build` ✅.

---

## Cross-links

- Backend gate + middleware:
  `deopt-v2-backend/docs/ADMIN_RBAC_ROUTE_ENFORCEMENT_V2G_W2.md`
- Threat model:
  `deopt-v2-backend/docs/ADMIN_AUTH_RBAC_THREAT_MODEL_V2G_V.md`
- W1 primitives (role / identity / auth-mode):
  `deopt-v2-backend/docs/ADMIN_JWT_RBAC_IMPLEMENTATION_V2G_W1.md`
- W0 constant-time token compare:
  `deopt-v2-backend/docs/ADMIN_TOKEN_CONSTANT_TIME_HARDENING_V2G_W0.md`
- Frontend production-readiness UI it gates:
  `deopt-v2-frontend/docs/ADMIN_V2_FEE_OBSERVABILITY_UI_V2G_U.md`
