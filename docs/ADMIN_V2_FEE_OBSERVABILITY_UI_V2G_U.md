# V2G-U — Admin V2 Fee Observability UI

## Status

- Milestone: **V2G-U** — adds a read-only **V2 Fee Production
  Readiness** section to the admin dashboard. Surfaces the V2G-T
  canonical fee audit pack state plus any live signal already loaded
  by the user.
- Date: 2026-06-01.
- Outcome:
  - **New component** `src/app/admin/production-readiness-section.tsx`
    (≈420 lines) — fully read-only.
  - **Single insertion** into `src/app/admin/admin-dashboard.tsx`:
    one import line + one JSX placement above the existing
    `V2FeeObservabilitySection`.
  - **Graceful degradation**: every endpoint reference checks
    `result.ok` and falls back to V2G-T static facts; never crashes
    on absent data, never spins on infinite loading.
  - **No new endpoints called**; reuses already-fetched
    `/admin/fees/v2/observability`, `/admin/fees/v2/smoke/readiness`,
    `/admin/fees/onchain` results that the dashboard already manages.
  - Validations: `npx tsc --noEmit` ✅, `npm run lint` ✅,
    `npm run build` ✅.
- Hard gates respected: no broadcast, no wallet writes, no live
  execution buttons, no chain mutation, no backend restart, no
  Docker / Prometheus touch, no `.env` edit. The new endpoint
  `/admin/fees/v2/smoke/readiness` is **optional** — when absent
  (backend not yet restarted), the section surfaces a
  "pending backend restart" badge instead of erroring.

## Files changed

| File | Change |
|---|---|
| `src/app/admin/production-readiness-section.tsx` | **NEW** — exports `<ProductionReadinessSection>` plus internal `StatusBadge`, `Row`, `SectionCard`, helpers. |
| `src/app/admin/admin-dashboard.tsx` | **MINIMAL** — one `import { ProductionReadinessSection }` + one JSX block placed above the `<V2FeeObservabilitySection>` element. No other changes. |

## UI sections added

The new section renders **6 cards** in a 2-column grid (collapses to
1 column on small screens):

| Card | What it shows |
|---|---|
| **V2 fee surface — live state** | FeesManagerV2 address; NEW PerpEngine; OLD PerpEngine (stranded); NEW MarginEngine; legacy MarginEngine (stranded); current fee recipient (Timelock). Each row carries a status badge sourced from the live observability snapshot if loaded, falling back to V2G-T static facts otherwise. |
| **Monitoring & anomaly signals** | OLD-consumer event count, unknown-consumer event count, per-asset rebate budget rows, local monitoring soak status (derived from observability success). |
| **OPTION RFQ readiness** | RFQ fee math (live), RFQ flow wiring (code-ready), OptionMatchingEngine (not deployed), backend RFQ signing surface (code-ready), preflight script (code-ready), deploy/rewire status (pending operator window). |
| **ProtocolFeeVault — future fee treasury** | Design spec, offline implementation, on-chain deployment (not deployed), future feeRecipient target. |
| **Admin endpoints** | Per-endpoint liveness derived from already-loaded fetches (`/admin/fees/v2/observability`, `/admin/fees/v2/smoke/readiness`, `/admin/fees/onchain`). |
| **V2G-E live cross-reference** | The two live tx hashes from the V2G-E smoke (PERP + OPTION) for cross-reference, with the canonical doc pointer. |

## Status badge palette

| Badge | Variant | Visual | Meaning |
|---|---|---|---|
| `live` | emerald | green | Currently live on Base Sepolia and confirmed by a live signal. |
| `code-ready` | sky | blue | ABI / source exists, tested offline, awaits broadcast or backend pickup. |
| `not deployed` | amber | yellow | Explicit "does not exist on chain" state. |
| `pending backend restart` | amber | yellow | Endpoint / code exists, but the running backend predates it. |
| `stranded` | red | red | Legacy artifact — must NOT be reused. Surfaces as an alarm. |
| `monitoring green` | emerald | green | Indirect signal that the observability path is healthy. |
| `monitoring degraded` | neutral | gray | Snapshot not loaded yet; not a failure, just no signal. |
| `unknown` | neutral | gray | Catch-all when both live and static fallbacks are unavailable. |

## Endpoint fallback behavior

The section never issues new fetches. It consumes the dashboard's
existing state:

| Source state | Section behavior |
|---|---|
| `observability == null` (user hasn't clicked "Load") | Static V2G-T facts; "monitoring degraded" badge; explanatory note tells the operator to load the V2 Fee Observability section above. |
| `observability.ok == false` | Static fallback + error-code surfaced in the explanatory note (`Endpoint error: ${code} (HTTP ${status})`). |
| `observability.ok == true` | Live addresses + rebate budget + anomaly counters; "monitoring green" badge. |
| `smokeReadiness == null` | "code-ready" badge — V2G-M endpoint may not be live yet. |
| `smokeReadiness.ok == false` | "pending backend restart" badge — the endpoint exists in target/ but binds only after backend restart. |
| `smokeReadiness.ok == true` | "live" badge — endpoint responded. |
| `feesOnchain == null` | "unknown" badge — operator hasn't queried a tx yet. |
| `feesOnchain.ok == false` | "pending backend restart" badge + error code. |
| `feesOnchain.ok == true` | "live" badge + last-query timestamp. |

There is **no infinite loading**: the section never opens a fetch,
so it never spins.

## Read-only guarantees

- No `<button onClick={…}>` issues a write.
- No wallet hooks (`useAccount`, `useConnect`, `useSignMessage`,
  etc.) are imported.
- No new admin-API methods. The two new component types are pure
  display components.
- The section never reads any `*.env` value at runtime — every
  address shown is either part of `STATIC_FACTS` (public Base
  Sepolia addresses, V2G-T audit-pack-derived) or read from the
  observability snapshot the backend already returned.

## Docs updated

- **New:** `deopt-v2-frontend/docs/ADMIN_V2_FEE_OBSERVABILITY_UI_V2G_U.md` (this file).

## Validations run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ clean (exit 0) |
| `npm run build` | ✅ static prerender of `/`, `/admin`, `/_not-found` |

## Soak preservation status

V2G-U is a frontend-only milestone. No backend / Docker / Prometheus
interaction:

| Check | State |
|---|---|
| Backend PID 56199 alive | ✅ (last read-only check before V2G-U work) |
| `/health` | ✅ |
| Prometheus / Grafana / Alertmanager / webhook-sink | ✅ all 18 h+ uptime |
| Backend restarted? | ❌ no |
| `.env` edited? | ❌ no |
| DB writes? | ❌ no |

The new component will only surface "live" badges after a future
backend restart picks up the V2G-M `/admin/fees/v2/smoke/readiness`
endpoint. Until then, the section displays "pending backend
restart" — matching the soak-preservation hard gate.

## Remaining blockers

1. **Backend restart for V2G-M endpoint pickup** — required to flip
   the readiness card from "pending backend restart" to "live".
2. **V2G-P live broadcast** — must happen for OPTION RFQ readiness
   card rows to flip from "code-ready" / "not deployed" to "live".
3. **V2G-R5 vault deploy** — must happen for the ProtocolFeeVault
   card to surface a real address instead of "(not deployed)".
4. **Target-host monitoring cutover (V2G-J)** — the local L0 stack
   carries the soak today; the section's "monitoring green" badge
   reflects local-compose health, not the canonical production host.

## Next recommended milestone

**V2G-W3 — Admin Operator Packet UI (Read-Only Mode).** Note:
this slot was previously labelled "V2G-V" in an earlier revision
of this doc; that label has since been claimed by the canonical
V2G-V Admin Auth / RBAC Threat Model
(`deopt-v2-backend/docs/ADMIN_AUTH_RBAC_THREAT_MODEL_V2G_V.md`),
so the UI-side follow-up is renamed to **V2G-W3** to avoid
collision.

Out of scope today (hard gate forbids wallet writes), but
once the operator broadcast windows for V2G-P / V2G-R5 are
scheduled, the admin UI should grow:

1. A toggleable "operator mode" guarded by an explicit consent gate.
2. A "Build operator packet" button that calls
   `build_option_rfq_operator_packet` server-side and surfaces the
   digest + calldata for offline signing.
3. A "Verify on chain" panel that re-runs
   `PreflightOptionRfqEntryPoints` against the configured
   addresses after the V2G-P redeploy.
4. A "Show vault state" panel that reads
   `ProtocolFeeVault.feeBalance`/`rebateReserve`/`grossFeesCollected`/`rebatesPaid`/`netRevenue`
   per asset after the V2G-R5 deploy.

V2G-W3 remains entirely read-only on chain (signing happens out
of band; the UI only displays signed payloads + post-broadcast
verification).

(Note: a separate **V2G-W3 backend track** also exists — Next.js
SSR proxy + JWT verifier, per
`deopt-v2-backend/docs/ADMIN_RBAC_ROUTE_ENFORCEMENT_V2G_W2.md`
§12. The two W3 tracks are independent and can ship in either
order; their pre-conditions are disjoint.)
