# V2G-AUDIT0 — Frontend Internal Audit Findings

## Status

- Milestone: **V2G-AUDIT0** — internal audit of the
  `/admin` dashboard, RBAC types/proxy docs, read-only display
  invariants, and the "no wallet / no write / no token-in-browser"
  surface.
- Date: 2026-06-01.

---

## 1. Summary by severity

| Severity | Count | Blocking pre-mainnet |
|---|---|---|
| Critical | 0 | — |
| High | 1 | **yes** |
| Medium | 1 | recommended |
| Low | 2 | optional |
| Info | 2 | no |

---

## 2. Findings

### F-H1 — Admin token still held in browser `sessionStorage` (V2G-V T2/T3 known limitation)

- **Severity:** High
- **Status:** open — documented blocker
- **Component:** `src/app/admin/admin-dashboard.tsx:32, 232, 401-409` + `src/lib/admin-api.ts:251` (`X-Admin-Token` header injection).
- **Description:** Today's admin UI takes the operator's `X-Admin-Token` via a password field, persists it in `sessionStorage["deopt.adminToken"]`, and injects it on every fetch. The V2G-V threat model T2/T3 documented this as a known exposure pending V2G-W3 SSR proxy.
- **Impact:** XSS in any part of the admin UI exfiltrates the token. Malicious browser extension also reads sessionStorage.
- **Exploit path:** Reflected/stored XSS → `localStorage.getItem("deopt.adminToken")` → POST to attacker server.
- **Evidence:** Source. V2G-V threat model §7 T2/T3.
- **Recommended fix:** V2G-W3 — Next.js `middleware.ts` + same-origin `/api/admin/[...path]/route.ts` SSR proxy + drop sessionStorage token. Spec lives in `deopt-v2-frontend/docs/ADMIN_FRONTEND_AUTH_PROXY_V2G_W2.md`.
- **Blocking:** mainnet — yes. V2G-P RFQ broadcast — no (operator can drive V2G-P from shell). V2G-R5 vault cutover — no (same).

### F-M1 — Production-Readiness section relies on `STATIC_FACTS` for the OPTION RFQ live state

- **Severity:** Medium
- **Status:** open — will resolve at V2G-P close
- **Component:** `src/app/admin/production-readiness-section.tsx::STATIC_FACTS`.
- **Description:** The RFQ readiness card hard-codes `optionMatchingEngine: null` and prints "not deployed". After the V2G-P broadcast, this static fact will be stale until a frontend PR updates it to the new live address.
- **Impact:** UI shows stale "not deployed" status post-V2G-P until the static-facts patch lands.
- **Recommended fix:** Either:
  1. Fetch the live address from `/admin/fees/v2/observability::contracts.option_matching_engine_*` once that endpoint surfaces it, OR
  2. Ship the static-facts patch as part of the V2G-P operator window (rebuild the frontend, deploy).
- **Blocking:** no — it's a UI accuracy item, not a security boundary.

### F-L1 — `admin-rbac-types.ts` not yet consumed by the live UI

- **Severity:** Low
- **Status:** open
- **Component:** `src/lib/admin-rbac-types.ts` (V2G-W2 type mirror).
- **Description:** The role-aware type mirror exists but `<AdminDashboard>` does not yet hide operator-class panels based on `roleImplies(...)`. The current UI shows all sections to anyone with the token.
- **Impact:** UX nicety only — the backend middleware (V2G-W2) is the security boundary. JS-side gating cannot be the auth check.
- **Recommended fix:** V2G-W3 — wire the SSR proxy to attach an `AdminIdentity` to each request; `<AdminDashboard>` reads it via a `useRole()` hook and hides panels accordingly.
- **Blocking:** no.

### F-L2 — `<ProductionReadinessSection>` 'live' badges depend on the operator having already clicked "Load V2 Fee Observability"

- **Severity:** Low
- **Status:** accepted (V2G-U design)
- **Component:** `src/app/admin/production-readiness-section.tsx`.
- **Description:** The card shows "monitoring degraded" badge until the operator loads the V2 Fee Observability section. This is the V2G-U design — the readiness card derives its signals from already-fetched dashboard state rather than issuing its own fetches.
- **Recommended fix:** None — intentional.
- **Blocking:** no.

### F-I1 — No wallet libraries / web3 hooks in the admin tree

- **Severity:** Info
- **Status:** accepted ✅
- **Component:** `package.json` + admin tree.
- **Description:** Verified absence of `wagmi`, `viem`, `ethers`, `@web3modal/*`, etc. in the admin tree imports. The V2G-V hard rule "no wallet signing in admin" is enforced by the absence of the dependency itself.
- **Recommended fix:** Lock this with a CI check that fails if any of those packages appear under `src/app/admin/**`.

### F-I2 — No `dangerouslySetInnerHTML` in the admin tree

- **Severity:** Info
- **Status:** accepted ✅
- **Component:** entire admin tree.
- **Description:** Verified absence of `dangerouslySetInnerHTML` in `src/app/admin/**`. React's auto-escaping is the XSS defense; this is the audit pin.
- **Recommended fix:** Add a CI lint rule (eslint-plugin-react/no-danger).

---

## 3. Hard-rule sweep

| Rule | Status |
|---|---|
| No wallet signing in admin | ✅ F-I1 |
| No live write buttons in admin | ✅ verified — no POST mutating fetches issued from the UI |
| No private-key input | ✅ verified — no fields, no env reads, no clipboard hooks |
| No backend admin token in browser | ❌ F-H1 — closed by V2G-W3 |
| Admin UI strictly read-only on chain | ✅ |
| No `dangerouslySetInnerHTML` | ✅ F-I2 |
| OIDC / hardware MFA at edge | ❌ pending V2G-W3 + infra deployment |
| Strict CSP | ❌ pending V2G-W3 |

---

## 4. Display-accuracy sweep

| Card | Accuracy |
|---|---|
| FeesManagerV2 + NEW MarginEngine + OLD PerpEngine + NEW PerpEngine | ✅ static facts match the live manifest |
| OPTION RFQ readiness (math live, flow code-ready, OptionMatchingEngine not deployed) | ✅ — will become stale post-V2G-P unless updated (F-M1) |
| ProtocolFeeVault readiness (design ready, impl offline, not deployed) | ✅ — will become stale post-V2G-R5 |
| V2G-E live tx cross-reference | ✅ |
| Local monitoring soak indicator | ✅ derived from observability snapshot success |

---

## 5. Error states / fallbacks

| Scenario | UI behavior |
|---|---|
| `/admin/fees/v2/observability` returns 4xx | Section renders the error code + still shows the static-facts fallback. Verified by V2G-U design. |
| `/admin/fees/v2/smoke/readiness` not yet live | Renders "pending backend restart" badge. Verified. |
| `/admin/fees/onchain?tx_hash=…` returns 4xx | Section renders the error code. Verified. |
| Backend unreachable | All sections render the error code; UI remains functional (no crash). Verified. |
| No infinite loading | Each fetch has an abort controller + finally block. Verified. |

---

## 6. Implementation status of small safe fixes

V2G-AUDIT0 implements no frontend source changes. F-H1 closes
with V2G-W3 (large milestone). F-M1 closes with the V2G-P
operator window (frontend rebuild). F-L1 is V2G-W3 follow-up.

---

## 7. Cross-links

- V2G-U production-readiness UI: `ADMIN_V2_FEE_OBSERVABILITY_UI_V2G_U.md`
- V2G-V threat model: `deopt-v2-backend/docs/ADMIN_AUTH_RBAC_THREAT_MODEL_V2G_V.md`
- V2G-W2 frontend proxy plan: `ADMIN_FRONTEND_AUTH_PROXY_V2G_W2.md`
- Audit gate decision: `~/DEOPT/AUDIT_GATE_DECISION_V2G_AUDIT0.md`
