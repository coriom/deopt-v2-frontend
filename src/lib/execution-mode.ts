// OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — execution-mode routing.
//
// The Options ticket asks the user which execution mode they want
// (`auto`, `book`, or `rfq`). The chain builds a leg list. This
// helper is the single source of truth for what should actually
// happen, given the current leg list and the flags.
//
// Rules (mirror of the milestone brief PART E):
//
//   * 0 legs                          → `empty` (picker guidance).
//   * 1 leg + `auto`                  → `book` (single-leg orderbook).
//   * 2+ legs + `auto`                → `rfq_multileg_blocked` if the
//                                        backend does NOT ship
//                                        multi-leg atomic RFQ; else
//                                        `rfq_multileg` (never reached
//                                        today).
//   * 1 leg + `book`                  → `book`.
//   * 2+ legs + `book`                → `book_blocked_multileg`.
//   * 1 leg + `rfq`                   → `rfq_single` when
//                                        `rfqEnabled=true`, else
//                                        `rfq_disabled`.
//   * 2+ legs + `rfq`                 → `rfq_multileg_blocked` until
//                                        `OPTIONS-MULTI-LEG-ATOMIC-RFQ-V1`.
//
// The helper is pure and deterministic. It is exercised by
// `tests/node/execution-mode.contract.mjs`.

export interface SelectedOptionLeg {
  /** Backend series id — the same id the orderbook route uses. */
  seriesId: string;
  /** Underlying symbol resolved via `underlyingDisplaySymbol` (e.g.
   * `"ETH"`, `"BTC"`, or a truncated `0xABCD…` when the underlying
   * has no display symbol registered). */
  underlying: string;
  /** ISO date of the expiry (`YYYY-MM-DD`). */
  expiry: string;
  /** Human strike label (e.g. `"1650"`). */
  strike: string;
  /** `call` or `put`. */
  optionType: "call" | "put";
  /** Whether we take (`buy` — from Ask) or lay (`sell` — from Bid). */
  side: "buy" | "sell";
  /** Which side of the book the price came from. */
  sourcePriceSide: "bid" | "ask";
  /** The price shown when the cell was clicked. Optional because
   * bid/ask availability is honest — the leg carries `undefined` if
   * the backend did not expose the price at click time. */
  displayPrice?: string;
  /** Ratio for strategy legs; defaults to `"1"`. String-shaped so
   * the ticket's ratio input can hold arbitrary decimals without
   * floating-point drift. */
  ratio: string;
  /** Optional product id — kept for chain highlighting consistency
   * with the legacy single-leg store. */
  productId?: string | null;
}

/** Deterministic key for a leg. Two clicks on the same (series,
 *  bid/ask) toggle the leg off. Two clicks on the SAME series but
 *  DIFFERENT sides (Bid then Ask) create two distinct legs so the
 *  ticket can build a spread from one row. */
export function legKey(leg: {
  seriesId: string;
  sourcePriceSide: "bid" | "ask";
}): string {
  return `${leg.seriesId}|${leg.sourcePriceSide}`;
}

export type RequestedExecutionMode = "auto" | "book" | "rfq";

export type ResolvedExecutionMode =
  | { kind: "empty" }
  | { kind: "book"; leg: SelectedOptionLeg }
  | { kind: "book_blocked_multileg" }
  | { kind: "rfq_single"; leg: SelectedOptionLeg }
  | { kind: "rfq_disabled" }
  | { kind: "rfq_multileg_blocked" };

export interface ResolveExecutionModeInput {
  requestedMode: RequestedExecutionMode;
  selectedLegs: SelectedOptionLeg[];
  /** Frontend flag `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED`. When false,
   *  requesting `rfq` with a single leg surfaces `rfq_disabled` and
   *  no request fires. */
  rfqEnabled: boolean;
  /** `NEXT_PUBLIC_OPTIONS_TWAP_ENABLED` — currently unused by the
   *  routing helper (TWAP is an Order Type inside Book, not an
   *  execution mode). Kept for symmetry with the ticket props. */
  twapEnabled?: boolean;
}

export function resolveExecutionMode(
  input: ResolveExecutionModeInput,
): ResolvedExecutionMode {
  const { requestedMode, selectedLegs, rfqEnabled } = input;
  const isMulti = selectedLegs.length > 1;
  const isEmpty = selectedLegs.length === 0;

  if (requestedMode === "book") {
    if (isEmpty) return { kind: "empty" };
    if (isMulti) return { kind: "book_blocked_multileg" };
    return { kind: "book", leg: selectedLegs[0] };
  }

  if (requestedMode === "rfq") {
    if (isMulti) return { kind: "rfq_multileg_blocked" };
    // 0 legs + rfq: no orderbook fallback — the user is explicitly
    // asking for RFQ, so surface the honest `rfq_disabled` copy
    // whether or not the frontend RFQ flag is on. RFQ needs at
    // least one leg to be meaningful.
    if (isEmpty) return { kind: "rfq_disabled" };
    if (!rfqEnabled) return { kind: "rfq_disabled" };
    return { kind: "rfq_single", leg: selectedLegs[0] };
  }

  // requestedMode === "auto"
  if (isEmpty) return { kind: "empty" };
  if (!isMulti) return { kind: "book", leg: selectedLegs[0] };
  // Multi-leg auto: today the backend does NOT support atomic
  // multi-leg RFQ, so auto blocks with the same honest copy as
  // an explicit `rfq` request would.
  return { kind: "rfq_multileg_blocked" };
}
