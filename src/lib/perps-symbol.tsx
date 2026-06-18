"use client";

// FRONTEND-PERPS-POLISH-V1 — shared perps symbol context.
//
// Mirrors the backend's `engine::state::default_markets()` seed,
// which is the only source of truth for which perp markets exist
// today. The provider lives in /perps only — it never touches the
// wallet or any external API.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface PerpsMarket {
  /** Backend market_id (engine seed). */
  marketId: number;
  /** Display symbol — same as backend `Market.symbol`. */
  symbol: string;
  /** Base asset for chart labels and underlying lookups. */
  base: string;
}

// Hard-coded to match `engine::state::default_markets()`. Adding a
// market here without the matching backend seed would be dishonest.
export const PERPS_MARKETS: PerpsMarket[] = [
  { marketId: 2, symbol: "BTC-PERP", base: "BTC" },
  { marketId: 1, symbol: "ETH-PERP", base: "ETH" },
];

interface PerpsSymbolCtx {
  market: PerpsMarket;
  setMarket: (symbol: string) => void;
  markets: PerpsMarket[];
}

const Ctx = createContext<PerpsSymbolCtx | null>(null);

export function PerpsSymbolProvider({ children }: { children: ReactNode }) {
  const [marketKey, setMarketKey] = useState<string>(PERPS_MARKETS[0].symbol);
  const market = useMemo(
    () =>
      PERPS_MARKETS.find((m) => m.symbol === marketKey) ?? PERPS_MARKETS[0],
    [marketKey],
  );
  const setMarket = useCallback((symbol: string) => {
    if (PERPS_MARKETS.some((m) => m.symbol === symbol)) {
      setMarketKey(symbol);
    }
  }, []);
  const value = useMemo<PerpsSymbolCtx>(
    () => ({ market, setMarket, markets: PERPS_MARKETS }),
    [market, setMarket],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePerpsSymbol(): PerpsSymbolCtx {
  const v = useContext(Ctx);
  // Fallback to BTC-PERP if a widget is mounted outside the provider
  // (e.g. previewed in isolation). Never throws — keeps the widget
  // testable in any sandbox.
  if (!v) {
    return {
      market: PERPS_MARKETS[0],
      markets: PERPS_MARKETS,
      setMarket: () => undefined,
    };
  }
  return v;
}
