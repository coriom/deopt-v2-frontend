"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPreset,
  initialStrategyState,
  summariseStrategy,
  updateLeg,
  type StrategyLeg,
  type StrategyPresetId,
  type StrategyState,
  type StrategyUnderlying,
} from "@/lib/rfq-strategy-model";
import { strategyToJson } from "@/lib/rfq-strategy-payoff";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { StrategyPresets } from "./StrategyPresets";
import { StrategyLegEditor } from "./StrategyLegEditor";
import { StrategyPayoffChart } from "./StrategyPayoffChart";
import { RfqStatusPanel } from "./RfqStatusPanel";
import { RfqQuotesTab } from "./RfqQuotesTab";
import { RfqAcceptModal } from "./RfqAcceptModal";
import { RfqTradesTab } from "./RfqTradesTab";
import {
  isOptionsRfqEnabled,
  OPTIONS_RFQ_ENABLED_ENV,
} from "@/lib/options-rfq-flag";
import { useWallet } from "@/lib/wallet";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import type { LifecycleEvent } from "@/lib/lifecycle-types";
import {
  cancelOptionsRfq,
  createOptionsRfq,
  listOptionsRfqs,
  listOptionsSeries,
  TradingApiError,
  type OptionRfqQuoteResponse,
  type OptionRfqResponse,
  type OptionSeriesResponse,
} from "@/lib/trading-api";
import {
  buildAuthorization,
  canonical,
  canonicalV2,
  type SignTypedDataFn,
} from "@/lib/write-auth";
import { underlyingDisplaySymbol } from "@/lib/underlying-symbols";

type Tab = "payoff" | "greeks" | "trades" | "book";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "payoff", label: "Payoff" },
  { id: "greeks", label: "Greeks" },
  { id: "trades", label: "Trades" },
  { id: "book", label: "Book" },
] as const;

type SubmitPhase =
  | { kind: "idle" }
  | { kind: "resolving_series" }
  | { kind: "requesting_challenge" }
  | { kind: "awaiting_signature" }
  | { kind: "submitting" }
  | { kind: "success"; rfqId: string }
  | { kind: "error"; message: string };

const ONE_E6 = BigInt("1000000");

function strikeTo1e8(strike: number): string {
  if (!Number.isFinite(strike) || strike <= 0) return "0";
  // Multiply as decimal-safe integer to avoid float noise.
  const cents = Math.round(strike * 100);
  return (BigInt(cents) * ONE_E6).toString();
}

function amountTo1e8(amount: number, ratio: number): string {
  const total = amount * ratio;
  if (!Number.isFinite(total) || total <= 0) return "0";
  const scaled = Math.round(total * 1_000_000); // 6-dec precision
  return (BigInt(scaled) * BigInt("100")).toString(); // scale up to 1e8
}

function matchSeries(
  series: readonly OptionSeriesResponse[],
  args: {
    underlyingSymbol: StrategyUnderlying;
    expiryMs: number;
    isCall: boolean;
    strike: number;
  },
): OptionSeriesResponse | undefined {
  const wantStrike1e8 = strikeTo1e8(args.strike);
  return series.find((s) => {
    if (s.is_call !== args.isCall) return false;
    // Backend `expiry` is milliseconds (u64). Compare loosely because
    // callers may pass a rounded day boundary.
    if (Number(s.expiry) !== args.expiryMs) return false;
    if (s.strike_1e8 !== wantStrike1e8) return false;
    const sym = underlyingDisplaySymbol(s.underlying);
    return sym === args.underlyingSymbol;
  });
}

function isSingleLeg(state: StrategyState): boolean {
  return state.legs.length === 1;
}

function primaryLeg(state: StrategyState): StrategyLeg | null {
  return isSingleLeg(state) ? state.legs[0] : null;
}

export function RfqStrategyWorkspace() {
  const [state, setState] = useState<StrategyState>(() => initialStrategyState("BTC"));
  const [tab, setTab] = useState<Tab>("payoff");
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<SubmitPhase>({ kind: "idle" });
  const [rfqs, setRfqs] = useState<OptionRfqResponse[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(false);
  const [rfqsError, setRfqsError] = useState<string | null>(null);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] =
    useState<OptionRfqQuoteResponse | null>(null);
  const [quoteRefreshNonce, setQuoteRefreshNonce] = useState(0);
  /**
   * OPTIONS-RFQ-TRADES-FEED-V1 — bumped whenever the Trades feed
   * needs to refetch from `GET /options/rfq-fills` (post-accept,
   * post-maker-submit, or user Refresh). The previous milestone's
   * session-local `sessionAcceptedFills` has been dropped — the
   * backend feed is now the single source of truth.
   */
  const [tradesRefreshNonce, setTradesRefreshNonce] = useState(0);

  const rfqEnabled = isOptionsRfqEnabled();
  const wallet = useWallet();
  const summary = useMemo(() => summariseStrategy(state), [state]);
  const canSubmit = rfqEnabled && isSingleLeg(state) && state.amount > 0;

  // Wallet gating (only meaningful when flag is on).
  const walletBlockers = useMemo(() => {
    if (!rfqEnabled) return null;
    if (!wallet.hasProvider) return "Connect a Base Sepolia wallet to request quotes.";
    if (!wallet.address) return "Connect your wallet to request quotes.";
    if (wallet.isMainnet) return "Mainnet is disabled — switch to Base Sepolia.";
    if (!wallet.isExpectedChain) return "Wrong network — switch to Base Sepolia.";
    // SUBACCOUNTS-RFQ-INTEGRATION-V1 — RFQ is now subaccount-aware
    // end-to-end (create + quote + accept + cancel + fills feed). The
    // previous "switch to Account 1" refusal is gone; non-default
    // subaccounts route through v2 canonical + envelope version 2.
    return null;
  }, [
    rfqEnabled,
    wallet.hasProvider,
    wallet.address,
    wallet.isMainnet,
    wallet.isExpectedChain,
  ]);

  const strategyBlocker = useMemo(() => {
    if (!rfqEnabled) return null;
    if (state.legs.length === 0) return "Add at least one leg to request a quote.";
    if (state.legs.length > 1) {
      return "Backend RFQ is single-leg per RFQ — multi-leg atomic RFQs will be added in a follow-up milestone.";
    }
    if (state.amount <= 0) return "Amount must be greater than zero.";
    return null;
  }, [rfqEnabled, state.legs.length, state.amount]);

  const onPreset = useCallback(
    (id: StrategyPresetId) => setState((s) => applyPreset(s, id)),
    [],
  );
  const onLegUpdate = useCallback(
    (id: string, patch: Parameters<typeof updateLeg>[2]) =>
      setState((s) => updateLeg(s, id, patch)),
    [],
  );

  const onCopyStrategy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(strategyToJson(state));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the JSON stays inline for manual copy.
    }
  }, [state]);

  const refreshRfqs = useCallback(async () => {
    if (!rfqEnabled) {
      setRfqs([]);
      return;
    }
    setRfqsLoading(true);
    setRfqsError(null);
    try {
      const all = await listOptionsRfqs();
      // Filter to the connected wallet's RFQs when a wallet is
      // present, AND to the active subaccount so switching the header
      // chip narrows the RFQ list to that subaccount. Backend list
      // route stays wallet-aggregate; the frontend filter is safe
      // because DTOs now carry `taker_subaccount_id`.
      const filtered = wallet.address
        ? all.filter((r) => {
            if (r.taker.toLowerCase() !== wallet.address!.toLowerCase()) {
              return false;
            }
            if (
              r.taker_subaccount_id !== undefined &&
              r.taker_subaccount_id !== wallet.activeSubaccountId
            ) {
              return false;
            }
            return true;
          })
        : [];
      setRfqs(filtered);
    } catch (e) {
      setRfqsError(
        e instanceof TradingApiError ? e.message : "Failed to load RFQs.",
      );
    } finally {
      setRfqsLoading(false);
    }
  }, [rfqEnabled, wallet.address, wallet.activeSubaccountId]);

  // Auto-refresh RFQ list on wallet change + on mount.
  const hasRunInitialRefresh = useRef(false);
  useEffect(() => {
    if (!rfqEnabled) return;
    if (!wallet.address) {
      setRfqs([]);
      return;
    }
    if (hasRunInitialRefresh.current === false) {
      hasRunInitialRefresh.current = true;
    }
    void refreshRfqs();
  }, [rfqEnabled, wallet.address, refreshRfqs]);

  // OPTIONS-RFQ-LIFECYCLE-WS-V1 — subscribe to `account.rfqs`
  // lifecycle deltas so create / quote-submitted / accepted /
  // fill-created / cancelled events trigger REST refetches
  // automatically. We only mount the subscription when the RFQ
  // feature flag is on AND a wallet is connected — the underlying
  // WS client only actually subscribes to `account.rfqs` in that
  // case (see `SUBSCRIBE_CHANNELS` in `lifecycle-ws.ts`).
  const lifecycle = useLifecycleStream();
  useEffect(() => {
    if (!rfqEnabled) return;
    if (!wallet.address) return;
    const unsubscribe = lifecycle.subscribe("account.rfqs", (event: LifecycleEvent) => {
      const payload = event.payload;
      switch (payload.type) {
        case "option_rfq_created":
        case "option_rfq_cancelled":
          // RFQ status list needs to reflect the new/updated row.
          void refreshRfqs();
          return;
        case "option_rfq_quote_submitted":
          // Book tab refetches the quotes for the selected RFQ.
          // If the delta is for the currently-selected RFQ (or any
          // RFQ the current user owns as taker), bumping the nonce
          // is enough — the Book tab only refetches when its own
          // selectedRfqId matches.
          setQuoteRefreshNonce((n) => n + 1);
          return;
        case "option_rfq_accepted":
        case "option_rfq_fill_created":
          // Accept produces two events (Accepted + FillCreated).
          // Refetch the RFQ list (status changed to Accepted),
          // the quote list (statuses changed), and the trades feed.
          void refreshRfqs();
          setQuoteRefreshNonce((n) => n + 1);
          setTradesRefreshNonce((n) => n + 1);
          return;
        default:
          // Unknown / non-RFQ payload — ignore safely.
          return;
      }
    });
    return unsubscribe;
  }, [rfqEnabled, wallet.address, lifecycle, refreshRfqs]);

  // Reconnect / resync guard — on every successful (re)subscribe,
  // refresh the REST state so we bridge any missed deltas.
  useEffect(() => {
    if (!rfqEnabled) return;
    if (!wallet.address) return;
    if (lifecycle.resyncToken === 0) return;
    void refreshRfqs();
    setQuoteRefreshNonce((n) => n + 1);
    setTradesRefreshNonce((n) => n + 1);
  }, [rfqEnabled, wallet.address, lifecycle.resyncToken, refreshRfqs]);

  const onRequestQuote = useCallback(async () => {
    if (!canSubmit || walletBlockers || strategyBlocker) return;
    if (!wallet.address) return;
    const leg = primaryLeg(state);
    if (!leg) return;

    setPhase({ kind: "resolving_series" });
    try {
      const series = await listOptionsSeries({
        is_call: leg.optionType === "call",
      });
      const matched = matchSeries(series, {
        underlyingSymbol: state.underlying,
        expiryMs: state.expiryMs,
        isCall: leg.optionType === "call",
        strike: leg.strike,
      });
      if (!matched) {
        setPhase({
          kind: "error",
          message: `No listed ${state.underlying} ${leg.optionType} series matches strike $${leg.strike.toLocaleString("en-US")} + expiry ${new Date(state.expiryMs).toISOString().slice(0, 10)}.`,
        });
        return;
      }

      const size1e8 = amountTo1e8(state.amount, leg.ratio);
      if (size1e8 === "0") {
        setPhase({
          kind: "error",
          message: "Amount resolves to zero contracts.",
        });
        return;
      }

      // SUBACCOUNTS-RFQ-INTEGRATION-V1 — pick v2 canonical + envelope
      // version 2 when the operator is on a non-default subaccount so
      // the backend routes the RFQ to the same subaccount that appears
      // in the switcher chip.
      const useV2 = wallet.activeSubaccountId > 1;
      const canonicalBytes = useV2
        ? canonicalV2.optionRfqCreate({
            taker: wallet.address,
            subaccountId: wallet.activeSubaccountId,
            optionSeriesId: matched.option_series_id,
            side: leg.side,
            size1e8,
            limitPrice1e8: null,
            ttlMs: null,
          })
        : canonical.optionRfqCreate({
            taker: wallet.address,
            optionSeriesId: matched.option_series_id,
            side: leg.side,
            size1e8,
            limitPrice1e8: null,
            ttlMs: null,
          });

      setPhase({ kind: "requesting_challenge" });
      const signTyped: SignTypedDataFn = async (args) => {
        setPhase({ kind: "awaiting_signature" });
        return wallet.signTypedData(args);
      };
      const authorization = await buildAuthorization({
        account: wallet.address,
        action: "OPTION_RFQ_CREATE",
        canonical: canonicalBytes,
        signTypedData: signTyped,
        version: useV2 ? 2 : undefined,
      });

      setPhase({ kind: "submitting" });
      const created = await createOptionsRfq({
        taker: wallet.address,
        subaccount_id: wallet.activeSubaccountId,
        option_series_id: matched.option_series_id,
        side: leg.side,
        size_1e8: size1e8,
        limit_price_1e8: null,
        ttl_ms: null,
        authorization,
      });
      setPhase({ kind: "success", rfqId: created.option_rfq_id });
      setSelectedRfqId(created.option_rfq_id);
      await refreshRfqs();
      setTab("book");
    } catch (e) {
      setPhase({
        kind: "error",
        message:
          e instanceof TradingApiError
            ? e.message
            : (e as Error).message || "Request Quote failed.",
      });
    }
  }, [
    canSubmit,
    walletBlockers,
    strategyBlocker,
    wallet,
    state,
    refreshRfqs,
  ]);

  const selectedRfq = useMemo(
    () =>
      selectedRfqId
        ? rfqs.find((r) => r.option_rfq_id === selectedRfqId) ?? null
        : null,
    [selectedRfqId, rfqs],
  );

  const onAcceptClick = useCallback((quote: OptionRfqQuoteResponse) => {
    setAcceptTarget(quote);
  }, []);

  // Never insert an optimistic row here — the child form has already
  // received the backend-confirmed quote, but the source of truth is
  // `GET /options/rfqs/{id}/quotes`. Bumping the refresh nonce forces
  // the Book tab to refetch that endpoint. Same for the Trades feed
  // (a maker submit doesn't produce a fill, but a subsequent accept
  // may, and this keeps the two feeds in sync).
  const onMakerQuoteSubmitted = useCallback(() => {
    setQuoteRefreshNonce((n) => n + 1);
    setTradesRefreshNonce((n) => n + 1);
  }, []);

  const onAcceptModalCancel = useCallback(() => {
    setAcceptTarget(null);
  }, []);

  const onAcceptSuccess = useCallback(async () => {
    // OPTIONS-RFQ-TRADES-FEED-V1 — the accept response is no
    // longer stored session-locally. The backend has persisted
    // the fill row synchronously, so we just bump the Trades
    // refresh nonce and let `GET /options/rfq-fills` produce
    // the authoritative view.
    setAcceptTarget(null);
    setQuoteRefreshNonce((n) => n + 1);
    setTradesRefreshNonce((n) => n + 1);
    setTab("trades");
    await refreshRfqs();
  }, [refreshRfqs]);

  const onCancelRfq = useCallback(
    async (rfqId: string) => {
      if (!rfqEnabled || !wallet.address) return;
      try {
        // SUBACCOUNTS-RFQ-INTEGRATION-V1 — cancel through the same
        // subaccount the RFQ was created under. The row-level target
        // is preferred but until the frontend surfaces
        // `taker_subaccount_id` on the RFQ list DTO, the active
        // subaccount is a safe proxy: the operator is filtering the
        // list by it via the reads below.
        const rfqRow = rfqs.find((r) => r.option_rfq_id === rfqId);
        const effectiveSubaccountId =
          rfqRow?.taker_subaccount_id ?? wallet.activeSubaccountId;
        const useV2 = effectiveSubaccountId > 1;
        const canonicalBytes = useV2
          ? canonicalV2.optionRfqCancel({
              taker: wallet.address,
              subaccountId: effectiveSubaccountId,
              optionRfqId: rfqId,
            })
          : canonical.optionRfqCancel({
              taker: wallet.address,
              optionRfqId: rfqId,
            });
        const authorization = await buildAuthorization({
          account: wallet.address,
          action: "OPTION_RFQ_CANCEL",
          canonical: canonicalBytes,
          signTypedData: wallet.signTypedData,
          version: useV2 ? 2 : undefined,
        });
        await cancelOptionsRfq(rfqId, {
          authorization,
          subaccount_id: effectiveSubaccountId,
        });
        await refreshRfqs();
      } catch (e) {
        setRfqsError(
          e instanceof TradingApiError
            ? e.message
            : (e as Error).message || "Cancel failed.",
        );
      }
    },
    [
      rfqEnabled,
      wallet.address,
      wallet.signTypedData,
      wallet.activeSubaccountId,
      rfqs,
      refreshRfqs,
    ],
  );

  const ctaDisabled =
    !rfqEnabled ||
    !canSubmit ||
    !!walletBlockers ||
    !!strategyBlocker ||
    phase.kind === "resolving_series" ||
    phase.kind === "requesting_challenge" ||
    phase.kind === "awaiting_signature" ||
    phase.kind === "submitting";

  const ctaLabel = !rfqEnabled
    ? "Request Quote — not enabled"
    : phase.kind === "resolving_series"
      ? "Resolving series…"
      : phase.kind === "requesting_challenge"
        ? "Requesting challenge…"
        : phase.kind === "awaiting_signature"
          ? "Awaiting wallet signature…"
          : phase.kind === "submitting"
            ? "Submitting…"
            : "Request Quote";

  const disabledReasonForTooltip = !rfqEnabled
    ? `RFQ creation is disabled in this environment (${OPTIONS_RFQ_ENABLED_ENV}=false).`
    : (walletBlockers ?? strategyBlocker ?? undefined);

  return (
    <div
      data-testid="rfq-strategy-workspace"
      data-rfq-enabled={rfqEnabled ? "true" : "false"}
      className="flex h-full min-h-0 flex-col gap-3 p-4 text-zinc-200"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-semibold text-zinc-100">
            RFQ / Strategy
          </h1>
          <span
            data-testid="rfq-strategy-status-pill"
            className="rounded border border-zinc-700 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400"
          >
            {rfqEnabled
              ? "single-leg RFQ create — live"
              : "builder foundation — Request Quote not live yet"}
          </span>
          {rfqEnabled && wallet.address && (
            <span
              data-testid="rfq-strategy-lifecycle-status"
              data-lifecycle-status={lifecycle.status}
              title={lifecycle.statusDetail ?? undefined}
              className={
                lifecycle.status === "subscribed"
                  ? "rounded border border-emerald-500/40 bg-emerald-500/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-300"
                  : lifecycle.status === "reconnecting" ||
                      lifecycle.status === "connecting" ||
                      lifecycle.status === "authenticating"
                    ? "rounded border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-300"
                    : "rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400"
              }
            >
              {lifecycle.status === "subscribed"
                ? "Live updates on"
                : lifecycle.status === "reconnecting" ||
                    lifecycle.status === "connecting" ||
                    lifecycle.status === "authenticating"
                  ? "Live updates reconnecting"
                  : "Manual refresh only"}
            </span>
          )}
        </div>
        <NativeSelect
          aria-label="Underlying"
          data-testid="rfq-strategy-underlying"
          value={state.underlying}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              underlying: e.target.value as StrategyUnderlying,
            }))
          }
          variant="bordered"
        >
          <option value="BTC" className="bg-zinc-950">
            BTC
          </option>
          <option value="ETH" className="bg-zinc-950">
            ETH
          </option>
        </NativeSelect>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(320px,1fr)_minmax(360px,1.4fr)]">
        {/* Left panel: builder */}
        <section
          data-testid="rfq-strategy-builder"
          className="flex flex-col gap-3 rounded border border-zinc-800 bg-black/40 p-3"
        >
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Preset
            </label>
            <StrategyPresets active={state.presetId} onSelect={onPreset} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Amount
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={state.amount}
                onChange={(e) =>
                  setState((s) => ({ ...s, amount: Number(e.target.value) }))
                }
                data-testid="rfq-strategy-amount"
                className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[12px] normal-case tracking-normal text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Expiry (ISO)
              <input
                type="text"
                value={new Date(state.expiryMs).toISOString().slice(0, 10)}
                readOnly
                data-testid="rfq-strategy-expiry"
                className="rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[12px] normal-case tracking-normal text-zinc-400"
                title="V1 uses the public-beta seed expiry (2026-12-31 UTC)"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Legs
            </span>
            <StrategyLegEditor legs={state.legs} onUpdate={onLegUpdate} />
          </div>

          <div className="mt-auto flex flex-col gap-2 border-t border-zinc-900 pt-3">
            <button
              type="button"
              disabled={ctaDisabled}
              data-testid="rfq-strategy-request-quote"
              data-ticket-mode={ctaDisabled ? "disabled" : "ready"}
              data-phase={phase.kind}
              title={disabledReasonForTooltip}
              onClick={ctaDisabled ? undefined : onRequestQuote}
              className={
                ctaDisabled
                  ? "cursor-not-allowed rounded bg-zinc-800 px-3 py-2 text-[12px] font-semibold text-zinc-500"
                  : "rounded bg-emerald-500 px-3 py-2 text-[12px] font-semibold text-zinc-950 hover:bg-emerald-400"
              }
            >
              {ctaLabel}
            </button>
            {phase.kind === "success" && (
              <p
                data-testid="rfq-strategy-submit-success"
                className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-300"
              >
                RFQ created: <span className="font-mono">{phase.rfqId}</span>
              </p>
            )}
            {phase.kind === "error" && (
              <p
                data-testid="rfq-strategy-submit-error"
                className="rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-[10px] text-red-300"
              >
                {phase.message}
              </p>
            )}
            {walletBlockers && (
              <p
                data-testid="rfq-strategy-wallet-blocker"
                className="text-[10px] text-amber-400"
              >
                {walletBlockers}
              </p>
            )}
            {strategyBlocker && (
              <p
                data-testid="rfq-strategy-strategy-blocker"
                className="text-[10px] text-amber-400"
              >
                {strategyBlocker}
              </p>
            )}
            <button
              type="button"
              onClick={onCopyStrategy}
              data-testid="rfq-strategy-copy"
              className="rounded border border-emerald-500/40 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/10"
            >
              {copied ? "Copied!" : "Copy strategy JSON"}
            </button>
            {!rfqEnabled && (
              <p
                data-testid="rfq-strategy-disabled-note"
                className="text-[10px] text-zinc-500"
              >
                RFQ creation is disabled in this environment
                (<code className="mx-1 rounded bg-zinc-900 px-1 text-emerald-300">
                  {OPTIONS_RFQ_ENABLED_ENV}=false
                </code>
                ). Backend routes are wired; the operator flips this flag
                per environment.
              </p>
            )}
          </div>

          {rfqEnabled && (
            <RfqStatusPanel
              rfqs={rfqs}
              loading={rfqsLoading}
              error={rfqsError}
              selectedRfqId={selectedRfqId}
              onSelect={setSelectedRfqId}
              onCancel={onCancelRfq}
              onRefresh={refreshRfqs}
            />
          )}
        </section>

        {/* Right panel: summary + tabs */}
        <section
          data-testid="rfq-strategy-preview"
          className="flex flex-col gap-3 rounded border border-zinc-800 bg-black/40 p-3"
        >
          <div
            data-testid="rfq-strategy-summary"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-100"
          >
            {summary}
          </div>

          <div
            role="tablist"
            aria-label="Strategy preview"
            data-testid="rfq-strategy-tabs"
            className="flex gap-1 border-b border-zinc-800"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`rfq-strategy-tab-${t.id}`}
                  data-selected={active ? "true" : "false"}
                  onClick={() => setTab(t.id)}
                  className={`rounded-t px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-b-2 border-emerald-400 text-zinc-100"
                      : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            data-testid={`rfq-strategy-tab-body-${tab}`}
            className="flex min-h-0 flex-1 flex-col"
          >
            {tab === "payoff" && <StrategyPayoffChart state={state} />}
            {tab === "greeks" && (
              <div className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500">
                Greeks will populate when live pricing/RFQ data is available.
                V1 keeps the chain-level dashes honest rather than inventing
                Δ/Γ/ν/Θ from a placeholder IV.
              </div>
            )}
            {tab === "trades" && (
              <RfqTradesTab
                rfqEnabled={rfqEnabled}
                account={wallet.address ?? null}
                selectedRfqId={selectedRfqId}
                refreshNonce={tradesRefreshNonce}
              />
            )}
            {tab === "book" && (
              <RfqQuotesTab
                rfqEnabled={rfqEnabled}
                selectedRfq={selectedRfq}
                takerAddress={wallet.address ?? null}
                onAcceptClick={onAcceptClick}
                refreshNonce={quoteRefreshNonce}
                onMakerQuoteSubmitted={onMakerQuoteSubmitted}
              />
            )}
          </div>
        </section>
      </div>

      {acceptTarget && selectedRfq && (
        <RfqAcceptModal
          rfq={selectedRfq}
          quote={acceptTarget}
          onCancel={onAcceptModalCancel}
          onAccepted={onAcceptSuccess}
        />
      )}
    </div>
  );
}
