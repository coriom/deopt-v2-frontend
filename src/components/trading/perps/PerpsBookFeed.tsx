"use client";

// FRONTEND-PERPS-POLISH-V1 — combined Order Book / Perps Feed widget.
//
// Two tabs that share a single widget frame: the orderbook ladder
// and the public trade feed. Both children are unchanged; only the
// tab strip is new. Tab selection persists for the lifetime of the
// session via a tiny localStorage key — small enough that a hook
// would be overkill.

import { useEffect, useState } from "react";
import { PerpsOrderbookWidget } from "./PerpsOrderbook";
import { PerpsTradeFeedWidget } from "./PerpsTradeFeed";

type Tab = "book" | "feed";

const STORAGE_KEY = "deopt-perps-book-feed-tab-v1";

function readTab(): Tab {
  if (typeof window === "undefined") return "book";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "feed" || raw === "book") return raw;
  } catch {
    /* fall through */
  }
  return "book";
}

function writeTab(t: Tab) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
}

export function PerpsBookFeedWidget() {
  const [tab, setTab] = useState<Tab>("book");

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const persisted = readTab();
    if (persisted !== tab) setTab(persisted);
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (next: Tab) => {
    setTab(next);
    writeTab(next);
  };

  return (
    <div
      data-testid="widget-perps-book-feed-body"
      className="flex h-full min-h-0 flex-col"
    >
      <div
        role="tablist"
        aria-label="Book or feed"
        data-testid="widget-perps-book-feed-tabs"
        className="flex items-center gap-1 border-b border-zinc-900 px-2 py-1"
      >
        <TabButton
          active={tab === "book"}
          onClick={() => select("book")}
          testid="widget-perps-book-feed-tab-book"
        >
          Order Book
        </TabButton>
        <TabButton
          active={tab === "feed"}
          onClick={() => select("feed")}
          testid="widget-perps-book-feed-tab-feed"
        >
          Perps Feed
        </TabButton>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "book" ? <PerpsOrderbookWidget /> : <PerpsTradeFeedWidget />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  testid,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testid}
      className={
        active
          ? "rounded px-2 py-0.5 text-[11px] font-semibold text-emerald-200"
          : "rounded px-2 py-0.5 text-[11px] font-semibold text-zinc-400 hover:text-emerald-200"
      }
    >
      {children}
    </button>
  );
}
