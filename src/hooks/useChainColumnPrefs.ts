"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ALL_COLUMN_IDS,
  DEFAULT_ORDER,
  DEFAULT_VISIBLE,
  type ColumnId,
} from "@/lib/chain-columns";

const STORAGE_KEY = "deopt-chain-cols-v1";

interface PrefsShape {
  visible: ColumnId[];
  order: ColumnId[];
}

const FALLBACK: PrefsShape = {
  visible: DEFAULT_VISIBLE.slice(),
  order: DEFAULT_ORDER.slice(),
};

function normalise(raw: unknown): PrefsShape {
  const known = new Set<ColumnId>(ALL_COLUMN_IDS);
  const v: ColumnId[] = [];
  const o: ColumnId[] = [];
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<PrefsShape>;
    if (Array.isArray(obj.visible)) {
      for (const id of obj.visible) if (known.has(id as ColumnId)) v.push(id as ColumnId);
    }
    if (Array.isArray(obj.order)) {
      for (const id of obj.order) if (known.has(id as ColumnId)) o.push(id as ColumnId);
    }
  }
  for (const id of DEFAULT_ORDER) if (!o.includes(id)) o.push(id);
  return {
    visible: v.length > 0 ? v : DEFAULT_VISIBLE.slice(),
    order: o,
  };
}

// Cache the parsed snapshot so `useSyncExternalStore` gets a stable
// reference between reads — the hook compares with `Object.is`.
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
      /* quota / disabled — silently ignore */
    }
  }
  cached = { raw: JSON.stringify(next), value: next };
  for (const l of listeners) l();
}

export interface ChainColumnPrefs {
  visibleOrdered: ColumnId[];
  order: ColumnId[];
  visible: Set<ColumnId>;
  toggle: (id: ColumnId) => void;
  reorder: (dragId: ColumnId, overId: ColumnId) => void;
  resetDefaults: () => void;
}

export function useChainColumnPrefs(): ChainColumnPrefs {
  // `getServerSnapshot` returns the same defaults the server rendered
  // with, so hydration stays consistent. After mount, the client
  // snapshot picks up any persisted prefs through `read()`.
  const prefs = useSyncExternalStore(subscribe, read, () => FALLBACK);

  const toggle = useCallback((id: ColumnId) => {
    const cur = read();
    const has = cur.visible.includes(id);
    const visible = has ? cur.visible.filter((x) => x !== id) : [...cur.visible, id];
    write({ ...cur, visible });
  }, []);

  const reorder = useCallback((dragId: ColumnId, overId: ColumnId) => {
    if (dragId === overId) return;
    const cur = read();
    const next = cur.order.filter((x) => x !== dragId);
    const idx = next.indexOf(overId);
    if (idx < 0) return;
    next.splice(idx, 0, dragId);
    write({ ...cur, order: next });
  }, []);

  const resetDefaults = useCallback(() => write(FALLBACK), []);

  const visibleSet = useMemo(() => new Set(prefs.visible), [prefs.visible]);
  const visibleOrdered = useMemo(
    () => prefs.order.filter((id) => visibleSet.has(id)),
    [prefs.order, visibleSet],
  );

  return {
    visibleOrdered,
    order: prefs.order,
    visible: visibleSet,
    toggle,
    reorder,
    resetDefaults,
  };
}
