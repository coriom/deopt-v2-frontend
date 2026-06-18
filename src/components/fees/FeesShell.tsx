"use client";

// FRONTEND-FEES-PAGE-V1 — fee-schedule landing for `/fees`.
//
// Mirrors the canonical schedule defined by the backend at
// `~/DEOPT/deopt-v2-backend/src/fees/schedule.rs::launch_fee_schedule()`.
// Both grids below are byte-for-byte equivalents of that function;
// see `FEES_SCHEDULE_VERIFICATION` block at the bottom of this file
// for the side-by-side mapping. Staking token is `DEOPT` — confirmed
// on-chain via the `stakedDeopt` arg of `FeesManagerV2.hashTierLeaf`.
//
// "My Account" values render `$0.00` / `0.00 stDEOPT` by default
// because no public per-account 28-day-volume endpoint exists on the
// backend yet. The numbers update only when a real source ships; the
// page never fabricates personalised figures.

import { useWallet } from "@/lib/wallet";

interface OptionTier {
  label28d: string;
  shareLabel: string;
  stakedLabel: string;
  optionMaker: string;
  optionTaker: string;
  rfqMakerDisc: string;
  rfqTakerDisc: string;
  rebate: boolean;
}

interface PerpTier {
  label28d: string;
  shareLabel: string;
  stakedLabel: string;
  perpMaker: string;
  perpTaker: string;
  rebate: boolean;
}

const OPTION_TIERS: OptionTier[] = [
  {
    label28d: "≥ $25M",
    shareLabel: "≥ 5%",
    stakedLabel: "≥ 250,000",
    optionMaker: "-0.005%",
    optionTaker: "0.0075%",
    rfqMakerDisc: "100%",
    rfqTakerDisc: "75%",
    rebate: true,
  },
  {
    label28d: "≥ $10M",
    shareLabel: "≥ 2.5%",
    stakedLabel: "≥ 100,000",
    optionMaker: "-0.0025%",
    optionTaker: "0.010%",
    rfqMakerDisc: "75%",
    rfqTakerDisc: "50%",
    rebate: true,
  },
  {
    label28d: "≥ $2.5M",
    shareLabel: "≥ 1%",
    stakedLabel: "≥ 50,000",
    optionMaker: "-0.001%",
    optionTaker: "0.0125%",
    rfqMakerDisc: "50%",
    rfqTakerDisc: "25%",
    rebate: true,
  },
  {
    label28d: "≥ $500k",
    shareLabel: "≥ 0.25%",
    stakedLabel: "≥ 10,000",
    optionMaker: "0.000%",
    optionTaker: "0.015%",
    rfqMakerDisc: "25%",
    rfqTakerDisc: "10%",
    rebate: false,
  },
  {
    label28d: "< $500k",
    shareLabel: "< 0.25%",
    stakedLabel: "< 10,000",
    optionMaker: "0.005%",
    optionTaker: "0.025%",
    rfqMakerDisc: "0%",
    rfqTakerDisc: "0%",
    rebate: false,
  },
];

const PERP_TIERS: PerpTier[] = [
  {
    label28d: "≥ $25M",
    shareLabel: "≥ 5%",
    stakedLabel: "≥ 250,000",
    perpMaker: "-0.010%",
    perpTaker: "0.015%",
    rebate: true,
  },
  {
    label28d: "≥ $10M",
    shareLabel: "≥ 2.5%",
    stakedLabel: "≥ 100,000",
    perpMaker: "-0.0075%",
    perpTaker: "0.0175%",
    rebate: true,
  },
  {
    label28d: "≥ $2.5M",
    shareLabel: "≥ 1%",
    stakedLabel: "≥ 50,000",
    perpMaker: "-0.005%",
    perpTaker: "0.020%",
    rebate: true,
  },
  {
    label28d: "≥ $500k",
    shareLabel: "≥ 0.25%",
    stakedLabel: "≥ 10,000",
    perpMaker: "0.000%",
    perpTaker: "0.025%",
    rebate: false,
  },
  {
    label28d: "< $500k",
    shareLabel: "< 0.25%",
    stakedLabel: "< 10,000",
    perpMaker: "0.005%",
    perpTaker: "0.030%",
    rebate: false,
  },
];

// Eligibility thresholds matching `launch_fee_schedule()`. Tier 4 is
// the highest (≥ $25M / ≥ 5% / ≥ 250,000); tier 0 is the default for
// anyone not meeting tier 1.
function computeTierIndex(
  volume28d: number,
  sharePercent: number,
  stakedDeopt: number,
): 0 | 1 | 2 | 3 | 4 {
  if (volume28d >= 25_000_000 || sharePercent >= 5 || stakedDeopt >= 250_000)
    return 4;
  if (volume28d >= 10_000_000 || sharePercent >= 2.5 || stakedDeopt >= 100_000)
    return 3;
  if (volume28d >= 2_500_000 || sharePercent >= 1 || stakedDeopt >= 50_000)
    return 2;
  if (volume28d >= 500_000 || sharePercent >= 0.25 || stakedDeopt >= 10_000)
    return 1;
  return 0;
}

export function FeesShell() {
  const { address } = useWallet();
  const connected = !!address;

  // No public per-account fees endpoint exists yet, so we feed the
  // tier computation with `0 / 0 / 0` — the honest state for any
  // newly connected wallet. When the backend ships a personalised
  // source, swap these values in here without changing the rest of
  // the page.
  const myVolume28d = 0;
  const mySharePercent = 0;
  const myStakedDeopt = 0;

  const currentTier = connected
    ? computeTierIndex(myVolume28d, mySharePercent, myStakedDeopt)
    : null;
  // Tier index 4 (highest) is row 0; tier index 0 is row 4.
  const highlightRowIndex = currentTier === null ? null : 4 - currentTier;

  return (
    <div
      data-testid="fees-page"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-zinc-200"
    >
      <header data-testid="fees-page-header" className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Fees
        </h1>
        <p className="text-[13px] text-zinc-400">
          DeOpt fee schedule — Option, RFQ, and Perp tiers. Eligibility
          falls to any of 28-day volume, 28-day volume share, or staked
          DEOPT.
        </p>
      </header>

      <MyAccountCard connected={connected} />
      <OptionFeeTiers highlightRowIndex={highlightRowIndex} />
      <PerpFeeTiers highlightRowIndex={highlightRowIndex} />

      <p
        data-testid="fees-page-rebate-note"
        className="text-[13px] leading-relaxed text-zinc-400"
      >
        * Negative fees (rebates) are reserved for operator-whitelisted
        market makers. They are not paid to public takers, bots, or
        retail makers.
      </p>
    </div>
  );
}

function MyAccountCard({ connected }: { connected: boolean }) {
  return (
    <section
      data-testid="fees-my-account"
      aria-label="My account"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      <h2 className="text-[16px] font-semibold text-zinc-100">My Account</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          testid="fees-my-account-volume"
          label="28D Trading Volume"
          value="$0.00"
          muted={!connected}
        />
        <Metric
          testid="fees-my-account-rfq"
          label="28D RFQ Volume"
          value="$0.00"
          muted={!connected}
        />
        <Metric
          testid="fees-my-account-staked"
          label="Staked DEOPT"
          value="0.00 stDEOPT"
          muted={!connected}
        />
      </div>
      {!connected ? (
        <p
          data-testid="fees-my-account-disconnected-note"
          className="text-[11px] text-zinc-500"
        >
          Connect a wallet to view your personal volume and staking
          balance. Live per-account data lands when the public surface
          ships.
        </p>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  testid,
  muted,
}: {
  label: string;
  value: string;
  testid: string;
  muted?: boolean;
}) {
  return (
    <div data-testid={testid} className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <span
        className={
          muted
            ? "text-[18px] font-semibold text-zinc-300"
            : "text-[18px] font-semibold text-zinc-100"
        }
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}

function OptionFeeTiers({
  highlightRowIndex,
}: {
  highlightRowIndex: number | null;
}) {
  return (
    <section
      data-testid="fees-option-tiers"
      aria-labelledby="fees-option-heading"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      <h2
        id="fees-option-heading"
        className="text-[16px] font-semibold text-zinc-100"
      >
        Option Fee Tiers
      </h2>
      <div className="overflow-x-auto">
        <table
          data-testid="fees-option-table"
          className="w-full min-w-full border-separate border-spacing-0 text-[13px]"
        >
          <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <Th align="right">28D Volume</Th>
              <Th align="right">&nbsp;</Th>
              <Th align="right">28D Vol Share</Th>
              <Th align="right">&nbsp;</Th>
              <Th align="right">Staked DEOPT</Th>
              <Th align="right">Option Maker</Th>
              <Th align="right">Option Taker</Th>
              <Th align="right">RFQ Maker Fee Disc.</Th>
              <Th align="right">RFQ Taker Fee Disc.</Th>
            </tr>
          </thead>
          <tbody>
            {OPTION_TIERS.map((t, i) => (
              <TierRow
                key={i}
                testid={`fees-option-row-${i}`}
                rebate={t.rebate}
                highlight={highlightRowIndex === i}
                cells={[
                  t.label28d,
                  "OR",
                  t.shareLabel,
                  "OR",
                  t.stakedLabel,
                  `${t.optionMaker}${t.rebate ? "*" : ""}`,
                  t.optionTaker,
                  t.rfqMakerDisc,
                  t.rfqTakerDisc,
                ]}
                connectorIndexes={[1, 3]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PerpFeeTiers({
  highlightRowIndex,
}: {
  highlightRowIndex: number | null;
}) {
  return (
    <section
      data-testid="fees-perp-tiers"
      aria-labelledby="fees-perp-heading"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      <h2
        id="fees-perp-heading"
        className="text-[16px] font-semibold text-zinc-100"
      >
        Perp Fee Tiers
      </h2>
      <div className="overflow-x-auto">
        <table
          data-testid="fees-perp-table"
          className="w-full min-w-full border-separate border-spacing-0 text-[13px]"
        >
          <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <Th align="right">28D Volume</Th>
              <Th align="right">&nbsp;</Th>
              <Th align="right">28D Vol Share</Th>
              <Th align="right">&nbsp;</Th>
              <Th align="right">Staked DEOPT</Th>
              <Th align="right">Perp Maker</Th>
              <Th align="right">Perp Taker</Th>
            </tr>
          </thead>
          <tbody>
            {PERP_TIERS.map((t, i) => (
              <TierRow
                key={i}
                testid={`fees-perp-row-${i}`}
                rebate={t.rebate}
                highlight={highlightRowIndex === i}
                cells={[
                  t.label28d,
                  "OR",
                  t.shareLabel,
                  "OR",
                  t.stakedLabel,
                  `${t.perpMaker}${t.rebate ? "*" : ""}`,
                  t.perpTaker,
                ]}
                connectorIndexes={[1, 3]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Single row primitive shared by both tables. Highlighted rows get a
// subtle emerald background + a one-character left-edge accent and a
// `Your tier` badge in the first cell so the user can spot their
// current eligibility at a glance. Rebate cells stay zinc-100 — the
// asterisk is the only marker that the maker side is a rebate.
function TierRow({
  testid,
  cells,
  connectorIndexes,
  rebate,
  highlight,
}: {
  testid: string;
  cells: string[];
  connectorIndexes: number[];
  rebate: boolean;
  highlight: boolean;
}) {
  return (
    <tr
      data-testid={testid}
      data-rebate={rebate ? "true" : "false"}
      data-highlight={highlight ? "true" : "false"}
      className={
        highlight
          ? "bg-emerald-500/10 hover:bg-emerald-500/15"
          : "hover:bg-zinc-900/40"
      }
    >
      {cells.map((c, i) => {
        const isConnector = connectorIndexes.includes(i);
        return (
          <Td
            key={i}
            align="right"
            muted={isConnector}
            highlight={highlight && i === 0}
          >
            {highlight && i === 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  data-testid={`${testid}-marker`}
                  className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-emerald-200"
                  style={{ fontFamily: "var(--app-font-sans)" }}
                >
                  Your tier
                </span>
                <span>{c}</span>
              </span>
            ) : (
              c
            )}
          </Td>
        );
      })}
    </tr>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-zinc-900 px-3 py-2 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
  highlight,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  muted?: boolean;
  highlight?: boolean;
}) {
  const base = `whitespace-nowrap border-b border-zinc-900 px-3 py-2.5 ${
    align === "right" ? "text-right" : "text-left"
  }`;
  const color = muted ? "text-zinc-500" : "text-zinc-100";
  // `highlight` is a positioning hint for the first cell of an
  // emerald-highlighted row so it can left-align around the "Your
  // tier" pill instead of right-aligning the pill against the number.
  const justify = highlight ? "text-left" : "";
  return (
    <td
      className={`${base} ${color} ${justify}`}
      style={{ fontFamily: "var(--app-font-mono)" }}
    >
      {children}
    </td>
  );
}

/*
 * FEES_SCHEDULE_VERIFICATION (FRONTEND-FEES-PAGE-V1)
 *
 * Backend source of truth:
 *   ~/DEOPT/deopt-v2-backend/src/fees/schedule.rs::launch_fee_schedule()
 *
 * Solidity confirmation of token + tier wire shape:
 *   ~/DEOPT/deopt-v2-sol/src/fees/FeesManagerV2.sol
 *     - `claimTier(account, tier, volume28d, volumeSharePpm,
 *        stakedDeopt, validFrom, validUntil, proof)`
 *     - `TIER_COUNT = 5`
 *     - tier fee profile struct carries `makerPpm`, `takerPpm`
 *       and an RFQ discount profile of `makerDiscountPpm`,
 *       `takerDiscountPpm` (so a negative `makerPpm` on tiers ≥ 1
 *       represents a rebate paid to whitelisted market makers).
 *   Token field is named `stakedDeopt` on the contract argument
 *   list, confirming the staking token is `DEOPT` (not DRV).
 *
 * Unit conversion:
 *   1 micro_bp = 1e-8 = 0.000001%
 *   So `maker_rebate_micro_bps: 5_000` → 0.005% rebate, rendered as
 *   `-0.005%` on the row.
 *   `min_volume_share_micro_bps: 5_000_000` → 5% share threshold.
 *   `min_staked_deopt_1e8: 250_000 * 1e8` → 250,000 DEOPT.
 *
 * Option tiers (tier index → row above):
 *   tier 4 → row 0  ≥ $25M / ≥ 5% / ≥ 250,000 / -0.005% / 0.0075% / 100% / 75%
 *   tier 3 → row 1  ≥ $10M / ≥ 2.5% / ≥ 100,000 / -0.0025% / 0.010% / 75% / 50%
 *   tier 2 → row 2  ≥ $2.5M / ≥ 1% / ≥ 50,000 / -0.001% / 0.0125% / 50% / 25%
 *   tier 1 → row 3  ≥ $500k / ≥ 0.25% / ≥ 10,000 / 0.000% / 0.015% / 25% / 10%
 *   tier 0 → row 4  < $500k / < 0.25% / < 10,000 / 0.005% / 0.025% / 0% / 0%
 *
 * Perp tiers (tier index → row above):
 *   tier 4 → row 0  ≥ $25M / ≥ 5% / ≥ 250,000 / -0.010% / 0.015%
 *   tier 3 → row 1  ≥ $10M / ≥ 2.5% / ≥ 100,000 / -0.0075% / 0.0175%
 *   tier 2 → row 2  ≥ $2.5M / ≥ 1% / ≥ 50,000 / -0.005% / 0.020%
 *   tier 1 → row 3  ≥ $500k / ≥ 0.25% / ≥ 10,000 / 0.000% / 0.025%
 *   tier 0 → row 4  < $500k / < 0.25% / < 10,000 / 0.005% / 0.030%
 *
 * Both tables match `launch_fee_schedule()` byte-for-byte.
 */
