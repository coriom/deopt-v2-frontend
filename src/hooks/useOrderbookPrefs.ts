"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type OrderbookColumnId = "price" | "size" | "total" | "totalPct";

export interface OrderbookColumnDef {
  id: OrderbookColumnId;
  label: string;
}

export const ORDERBOOK_COLUMNS: OrderbookColumnDef[] = [
  { id: "price", label: "Price" },
  { id: "size", label: "Size" },
  { id: "total", label: "Total" },
  { id: "totalPct", label: "Total %" },
];

const ALL_IDS: OrderbookColumnId[] = ORDERBOOK_COLUMNS.map((c) => c.id);
const DEFAULT_VISIBLE: OrderbookColumnId[] = ["price", "size", "total"];

const STORAGE_KEY = "deopt-orderbook-cols-v1";

interface PrefsShape {
  visible: OrderbookColumnId[];
  /** Tick grouping in basis points × 10 (1 = 0.01%). 0 = no grouping. */
  groupBps: number;
}

const FALLBACK: PrefsShape = {
  visible: DEFAULT_VISIBLE.slice(),
  groupBps: 0,
};

export const GROUPING_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Default" },
  { value: 1, label: "0.01%" },
  { value: 5, label: "0.05%" },
  { value: 10, label: "0.10%" },
  { value: 50, label: "0.50%" },
];

function normalise(raw: unknown): PrefsShape {
  const known = new Set<OrderbookColumnId>(ALL_IDS);
  let visible: OrderbookColumnId[] = [];
  let groupBps = 0;
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<PrefsShape>;
    if (Array.isArray(obj.visible)) {
      for (const id of obj.visible) {
        if (known.has(id as OrderbookColumnId)) visible.push(id as OrderbookColumnId);
      }
    }
    if (typeof obj.groupBps === "number" && GROUPING_OPTIONS.some((o) => o.value === obj.groupBps)) {
      groupBps = obj.groupBps;
    }
  }
  if (visible.length === 0) visible = DEFAULT_VISIBLE.slice();
  return { visible, groupBps };
}

let cached: { raw: string | null; value: PrefsShape } = {
  raw: "<uninit>",
  value: FALLBACK,
};

function read(): PrefsShape {
  if (typeof window === "undefined") return FALLBACK;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return FALLBACK;
  }
  if (cached.raw === raw) return cached.value;
  try {
    const value = raw ? normalise(JSON.parse(raw)) : FALLBACK;
    cached = { raw, value };
    return value;
  } catch {
    cached = { raw, value: FALLBACK };
    return FALLBACK;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(l: Listener) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) l();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function write(next: PrefsShape) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  cached = { raw: JSON.stringify(next), value: next };
  for (const l of listeners) l();
}

export interface OrderbookPrefs {
  visible: Set<OrderbookColumnId>;
  visibleOrdered: OrderbookColumnId[];
  groupBps: number;
  toggle: (id: OrderbookColumnId) => void;
  setGroupBps: (v: number) => void;
  resetDefaults: () => void;
}

export function useOrderbookPrefs(): OrderbookPrefs {
  const prefs = useSyncExternalStore(subscribe, read, () => FALLBACK);
  const toggle = useCallback((id: OrderbookColumnId) => {
    const cur = read();
    const has = cur.visible.includes(id);
    const visible = has ? cur.visible.filter((x) => x !== id) : [...cur.visible, id];
    write({ ...cur, visible });
  }, []);
  const setGroupBps = useCallback((v: number) => {
    const cur = read();
    write({ ...cur, groupBps: v });
  }, []);
  const resetDefaults = useCallback(() => write(FALLBACK), []);
  const visibleSet = useMemo(() => new Set(prefs.visible), [prefs.visible]);
  const visibleOrdered = useMemo(
    () => ALL_IDS.filter((id) => visibleSet.has(id)),
    [visibleSet],
  );
  return {
    visible: visibleSet,
    visibleOrdered,
    groupBps: prefs.groupBps,
    toggle,
    setGroupBps,
    resetDefaults,
  };
}
