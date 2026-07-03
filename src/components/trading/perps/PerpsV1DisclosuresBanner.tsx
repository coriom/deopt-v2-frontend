// PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — V1 caveat disclosures.
//
// Two honest statements that must be visible on `/perps` before any
// public route unlock:
//
//   1. Mark price semantics — `mark == index` in V1; premium math is
//      deferred. Traders relying on a real funding-premium mark need
//      to know the number they see is the index price only.
//   2. Funding accrual — the backend funding engine is wired end-to-
//      end, but the on-chain `FundingConfig.isEnabled` is `false` for
//      both ETH-PERP and BTC-PERP so cumulative funding stays at 0 →
//      every settlement is a legitimate zero-payment no-op.
//
// This banner renders on `/perps` regardless of the strict opt-in
// ticket enablement flag (`NEXT_PUBLIC_PERPS_TICKET_ENABLED`). Its
// content does not depend on wallet state; it is purely a factual
// statement about the V1 protocol posture.

export function PerpsV1DisclosuresBanner() {
  return (
    <div
      data-testid="perps-v1-disclosures-banner"
      className="flex flex-col gap-1 border-b border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-300"
    >
      <div className="flex items-start gap-2">
        <span className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span data-testid="perps-v1-disclosure-mark">
          <strong className="font-semibold text-zinc-100">
            V1 mark price
          </strong>{" "}
          equals the oracle index price; the funding premium is not
          included yet.
        </span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span data-testid="perps-v1-disclosure-funding">
          <strong className="font-semibold text-zinc-100">
            V1 funding
          </strong>{" "}
          is wired, but on-chain funding is currently disabled for
          ETH-PERP and BTC-PERP — every settlement stays at 0 until an
          operator flips the on-chain flag.
        </span>
      </div>
    </div>
  );
}
