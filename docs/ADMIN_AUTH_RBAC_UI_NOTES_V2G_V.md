# V2G-V — Admin Auth + RBAC UI Notes

Companion to `deopt-v2-backend/docs/ADMIN_AUTH_RBAC_THREAT_MODEL_V2G_V.md`.
Frontend-specific design notes only. **Docs-only** — no code change
in V2G-V.

## Current auth model (as of V2G-U close)

| Surface | Behaviour |
|---|---|
| Token storage | `sessionStorage["deopt.adminToken"]` (`src/app/admin/admin-dashboard.tsx:32, 232, 401-409`) |
| Token transport | `X-Admin-Token` header injected by `src/lib/admin-api.ts:251` |
| Per-request gate | `ensure_admin_access` in backend (`src/api/routes.rs:1442`) — single shared token |
| Roles enforced in UI | none — anyone with the token sees the full dashboard |
| Wallet signing | none, by design (V2G-O / V2G-P0 / V2G-P1 / V2G-R0 / V2G-U) |
| Mutation buttons | none — the dashboard is read-only end-to-end today |
| OIDC / Cloudflare Access | not deployed |

## Target architecture (post-V2G-W)

```
Browser  ──▶  Cloudflare Access (OIDC + MFA)
              │
              ▼
       Next.js /admin/* (server-side middleware)
              │
              │  • verify OIDC session
              │  • mint backend JWT bound to identity + role
              │  • forward via /api/admin/* (same-origin)
              │  • write audit-log line (identity, route, status)
              │
              ▼
       deopt-v2-backend /admin/* (JWT-verified, role-gated)
```

### Key invariants the frontend must hold

1. **The backend admin token / JWT NEVER lives in the browser**.
   Today's `sessionStorage["deopt.adminToken"]` is the migration
   target — V2G-W deletes this path. Replace with a same-origin
   `/api/admin/*` proxy whose backend secrets live in
   `process.env.BACKEND_ADMIN_TOKEN` and which is only callable by
   the SSR layer.
2. **No wallet libraries** (`wagmi`, `viem`, `ethers`, `@web3modal/*`)
   in the admin tree. The admin pages must be entirely read-only
   on chain. Operator signing happens out-of-band (hardware wallet,
   shell-only signing CLI). The dashboard only displays digests +
   calldata.
3. **No `dangerouslySetInnerHTML`** in the admin tree. Confirmed
   absent in V2G-U audit. Keep this invariant: backend JSON is
   piped through React's auto-escaping.
4. **No `eval` / `Function` constructor**, no `document.write`,
   no `innerHTML` on user-controlled data.
5. **Strict CSP** at the Next.js layer: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`.

## Role-driven UI gating

V2G-V design recommendation. Implementation in V2G-W.

| UI surface | viewer | operator | governance-admin | breakglass |
|---|---|---|---|---|
| Dashboard top header (status / token field) | visible | visible (replaced by identity) | visible | visible |
| Existing read-only sections (Status, Config, DB, Lifecycle, V2 Fee Observability, ProductionReadiness, V2G-E references) | ✅ | ✅ | ✅ | ✅ |
| V2 Fee Smoke Readiness | hidden | ✅ | ✅ | ✅ |
| `Build operator packet` panel (V2G-W) | hidden | ✅ | ✅ | ✅ |
| `Run reconciliation tick` button (V2G-W) | hidden | ✅ | ✅ | ✅ |
| `Generate governance calldata` panel (V2G-W) | hidden | hidden | ✅ | ✅ |
| `Breakglass` page (V2G-W) | hidden | hidden | hidden | ✅ (separate URL with edge enforcement) |

Gating happens at the Next.js middleware layer first (server-side,
authoritative), then a UI-only `useRole()` hook hides forbidden
panels client-side as a UX nicety. The UI-side hiding is **never**
the security boundary — the proxy refuses the underlying fetch.

## Operator-mode consent toggle

For operator-class actions (preflight packet generation,
reconciliation tick), the frontend should display an explicit
consent banner before unhiding the panels. Design:

- Banner reads: *"You are about to enter operator mode. Operator
  actions may mutate backend indexer state and produce calldata
  for off-band signing. They will not broadcast on chain or sign
  anything in your browser."*
- Toggle is per-session, not persistent.
- Toggle requires explicit `OPERATOR_MODE_CONSENT=true` env var
  on the Next.js host AND the role must be ≥ `operator`. Belt and
  braces.
- Toggle does NOT lower the auth posture — it only un-hides UI
  surfaces the user is already authorized for.

## Things the frontend must NEVER do

| Anti-pattern | Why |
|---|---|
| Hold the backend admin token / JWT in the browser | T2 + T3 — once XSS lands or sessionStorage is exfiltrated, the attacker authenticates as the operator. |
| Read `process.env.BACKEND_ADMIN_TOKEN` from a Client Component | Next.js may bundle it into the JS chunk. Always read inside Server Components / API routes. |
| Use `<script src="…"/>` with off-origin URLs | Defeats CSP. |
| Use `target="_blank"` without `rel="noopener noreferrer"` | Window-opener-side XSS vector. |
| Render unsanitised query parameters into the DOM | Reflected XSS. React auto-escapes string children — keep all rendering through that path. |
| Persist any auth state across browser tabs without server confirmation | Mixed-state UX risk + reflects out-of-date session validity. |
| Add a "Send transaction" button anywhere in `/admin` | Hard gate from the V2G-V threat model + V2G-O / V2G-P1 / V2G-R0 secret policy. |

## Files / surfaces to inventory before V2G-W

- `src/app/admin/admin-dashboard.tsx` — the entire admin SPA shell.
- `src/lib/admin-api.ts` — the only place that reads the admin token. V2G-W replaces this with `/api/admin/*` calls.
- `src/types/admin.ts` — JSON typings, no auth logic.
- `src/app/admin/production-readiness-section.tsx` — pure display, no auth concerns (V2G-U).
- New (V2G-W): `src/app/api/admin/[...path]/route.ts` — server-side proxy with JWT minting.
- New (V2G-W): `src/middleware.ts` — `/admin/*` OIDC gate.
- New (V2G-W): `src/lib/role.ts` — role helpers exposed via a `useRole()` hook + the SSR `getRole()` server-only helper.

## CSP / security headers checklist (V2G-W)

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |

Apply via `next.config.ts` `headers()` callback in V2G-W.

## Cross-links

- Threat model + RBAC: `deopt-v2-backend/docs/ADMIN_AUTH_RBAC_THREAT_MODEL_V2G_V.md`.
- Production-readiness UI surface this protects: `deopt-v2-frontend/docs/ADMIN_V2_FEE_OBSERVABILITY_UI_V2G_U.md`.
- Canonical fee audit pack: `deopt-v2-backend/docs/DEOPT_V2_CANONICAL_FEE_AUDIT_PACK_V2G_T.md`.
- Off-band signing reference: `deopt-v2-backend/docs/OPTION_RFQ_OPERATOR_PACKET_V2G_P1.md`.

## Soak preservation

V2G-V is docs-only. The frontend dev server is NOT running during
this work; no live frontend service to disturb. The admin backend
soak (PID 56199) is unaffected — confirmed by parallel read-only
`/health` check.

## Next milestone

**V2G-W** — implement the V2G-V design. Recommended slice order:

1. Backend constant-time compare in `src/admin.rs::token_matches`.
2. Backend audit-log writer + test.
3. Next.js middleware + same-origin `/api/admin/*` proxy + drop
   sessionStorage token.
4. JWT + per-route role gate in the backend (dual-path during cutover).
5. CORS allowlist + integration tests.
6. CSP / security headers in `next.config.ts`.

Each step is independently shippable behind a feature flag.
