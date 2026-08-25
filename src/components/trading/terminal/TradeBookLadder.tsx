"use client";

// Live top-of-book ladder for the Trade widget's "Book" tab.
//
// Columns: Price · Size · Total. Asks are stacked with the highest
// price at the very top and the best ask (lowest of the asks) sitting
// flush against the spread band. Bids are stacked with the best bid
// (highest bid price) flush against the spread on top, descending
// downwards. When there are fewer real levels than the visible slot
// count, the missing rows render as blank space — no `—`
// placeholders — so the ladder honestly shows what's there and
// nothing more (testnet posture: never fabricate depth).

import { useMemo } from "react";
import { useOrderbook } from "@/hooks/trading";
import { scaled1e8ToHuman } from "@/lib/price-scaling";

interface TradeBookLadderProps {
  seriesId: string | null;
  /** Human-readable instrument title, used in the empty state. */
  instrumentTitle?: string;
}

/** Number of visible rows on each side of the spread. */
const LEVELS_PER_SIDE = 6;

interface Level {
  price: string;
  size: string;
  total: string;
  /** 0..1 depth ratio used to size the row's backdrop. */
  depth: number;
  /** Whether this row carries live data. Blank rows render as
   *  transparent placeholders that only preserve row height. */
  live: boolean;
}

function emptyLevel(): Level {
  // Non-breaking spaces preserve each cell's line-height so the row's
  // vertical footprint matches the live rows — otherwise empty spans
  // collapse and the ladder rows become inconsistent heights.
  return { price: " ", size: " ", total: " ", depth: 0, live: false };
}

export function TradeBookLadder({ seriesId, instrumentTitle }: TradeBookLadderProps) {
  const { data, error, isLoading } = useOrderbook(seriesId);

  const { asks, bids, spread, spreadPct } = useMemo(() => {
    const top = data?.data.orderbook_top;
    const askPrice = top?.best_ask_price_1e8;
    const askSize = top?.best_ask_size;
    const bidPrice = top?.best_bid_price_1e8;
    const bidSize = top?.best_bid_size;

    // Build ask column: LEVELS_PER_SIDE rows top-down (deepest → best).
    // The row closest to the spread (index LEVELS_PER_SIDE - 1) is the
    // live best ask; earlier rows are placeholders.
    const askRows: Level[] = Array.from({ length: LEVELS_PER_SIDE }, () => emptyLevel());
    if (askPrice && askSize) {
      askRows[LEVELS_PER_SIDE - 1] = {
        price: scaled1e8ToHuman(askPrice),
        size: scaled1e8ToHuman(askSize),
        total: scaled1e8ToHuman(askSize),
        depth: 1,
        live: true,
      };
    }

    // Build bid column: LEVELS_PER_SIDE rows top-down (best → deepest).
    // Row 0 is the live best bid; deeper rows are placeholders.
    const bidRows: Level[] = Array.from({ length: LEVELS_PER_SIDE }, () => emptyLevel());
    if (bidPrice && bidSize) {
      bidRows[0] = {
        price: scaled1e8ToHuman(bidPrice),
        size: scaled1e8ToHuman(bidSize),
        total: scaled1e8ToHuman(bidSize),
        depth: 1,
        live: true,
      };
    }

    let sp: string | null = null;
    let spPct: string | null = null;
    if (askPrice && bidPrice) {
      try {
        const ap = BigInt(askPrice);
        const bp = BigInt(bidPrice);
        const diff = ap - bp;
        sp = scaled1e8ToHuman(diff.toString());
        // Spread % of mid = (ask - bid) / ((ask + bid) / 2)
        // Compute in BigInt with 4 decimals of precision then format.
        const mid = (ap + bp) / BigInt(2);
        if (mid > BigInt(0)) {
          const pct10000 = (diff * BigInt(10000)) / mid;
          const whole = pct10000 / BigInt(100);
          const frac = pct10000 % BigInt(100);
          spPct = `${whole.toString()}.${frac.toString().padStart(2, "0")}%`;
        }
      } catch {
        sp = null;
      }
    }

    return { asks: askRows, bids: bidRows, spread: sp, spreadPct: spPct };
  }, [data]);

  // Empty state: no series picked.
  if (!seriesId) {
    return (
      <div
        data-testid="trade-tab-book-body"
        className="px-3 py-2 text-[11px] text-zinc-500"
      >
        Pick an instrument to preview its book.
      </div>
    );
  }

  // Loading state (first fetch only).
  if (isLoading && !data) {
    return (
      <div
        data-testid="trade-tab-book-body"
        className="px-3 py-2 text-[11px] text-zinc-500"
      >
        Loading book{instrumentTitle ? ` for ${instrumentTitle}` : ""}…
      </div>
    );
  }

  // Error state.
  if (error) {
    return (
      <div
        data-testid="trade-tab-book-body"
        className="px-3 py-2 text-[11px] text-red-300"
      >
        Failed to load book.
      </div>
    );
  }

  // Live ladder — no outer border / bg so the widget frame is the
  // only visible edge; row-level `px-3` keeps horizontal breathing
  // room from the widget chrome.
  return (
    <div
      data-testid="trade-tab-book-body"
      className="font-mono text-[11px]"
      style={{ fontFamily: "var(--app-font-mono)" }}
    >
      <BookHeader />
      <div data-testid="trade-book-asks" role="rowgroup">
        {asks.map((row, i) => (
          <BookRow key={`ask-${i}`} side="ask" idx={i} row={row} />
        ))}
      </div>
      <SpreadBand spread={spread} spreadPct={spreadPct} />
      <div data-testid="trade-book-bids" role="rowgroup">
        {bids.map((row, i) => (
          <BookRow key={`bid-${i}`} side="bid" idx={i} row={row} />
        ))}
      </div>
    </div>
  );
}

function BookHeader() {
  return (
    <div
      className="grid grid-cols-3 gap-3 border-b border-zinc-900 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500"
      style={{ fontFamily: "var(--app-font-sans)" }}
    >
      <span className="text-left">Price</span>
      <span className="text-left">Size</span>
      <span className="text-left">Total</span>
    </div>
  );
}

function BookRow({
  side,
  idx,
  row,
}: {
  side: "ask" | "bid";
  idx: number;
  row: Level;
}) {
  const priceColor =
    side === "ask"
      ? row.live
        ? "text-red-400"
        : "text-red-400/40"
      : row.live
        ? "text-emerald-400"
        : "text-emerald-400/40";
  const cellColor = row.live ? "text-zinc-100" : "text-zinc-600";
  const depthColor = side === "ask" ? "bg-red-500/15" : "bg-emerald-500/15";
  return (
    <div
      role="row"
      data-testid={`trade-book-row-${side}-${idx}`}
      data-live={row.live ? "true" : "false"}
      className="relative grid grid-cols-3 gap-3 px-3 py-[3px]"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 ${depthColor}`}
        style={{ width: `${Math.max(0, Math.min(1, row.depth)) * 100}%` }}
      />
      <span className={`relative text-left ${priceColor}`}>{row.price}</span>
      <span className={`relative text-left ${cellColor}`}>{row.size}</span>
      <span className={`relative text-left ${cellColor}`}>{row.total}</span>
    </div>
  );
}

function SpreadBand({
  spread,
  spreadPct,
}: {
  spread: string | null;
  spreadPct: string | null;
}) {
  return (
    <div
      data-testid="trade-book-spread"
      className="grid grid-cols-3 gap-3 bg-zinc-900/60 px-3 py-1 text-[11px]"
      style={{ fontFamily: "var(--app-font-sans)" }}
    >
      <span className="text-left text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        Spread
      </span>
      <span
        className="text-left font-mono text-zinc-200"
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        {spread ? `$${spread}` : "—"}
      </span>
      <span
        className="text-left font-mono text-zinc-400"
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        {spreadPct ?? "—"}
      </span>
    </div>
  );
}
