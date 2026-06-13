"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";

export interface SelectedOption {
  leg: OptionLeg;
  row: OptionsChainRow;
  productId: string | null;
}

interface SelectedOptionContextValue {
  selected: SelectedOption | null;
  setSelected: (s: SelectedOption | null) => void;
}

const Ctx = createContext<SelectedOptionContextValue | null>(null);

export function SelectedOptionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SelectedOption | null>(null);
  const value = useMemo(() => ({ selected, setSelected }), [selected]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelectedOption(): SelectedOptionContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Defensive default — widgets outside a provider just behave as if
    // nothing is selected.
    return { selected: null, setSelected: () => {} };
  }
  return v;
}
