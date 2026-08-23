"use client";

// Brightness preference — module-scoped store, same shape as
// `language-context` / `useChainColumnPrefs`. Every mutation both
// persists to localStorage and applies the CSS filter to
// <html> so all subscribers stay visually in sync (including
// cross-tab updates via the `storage` event).

import { useCallback, useSyncExternalStore } from "react";
import {
  BRIGHTNESS_STORAGE_KEY,
  DEFAULT_BRIGHTNESS_PCT,
  brightnessPctToFilter,
  clampBrightness,
} from "./brightness";

let cached: { raw: string | null; value: number } = {
  raw: "<uninit>",
  value: DEFAULT_BRIGHTNESS_PCT,
};

function applyToDom(pct: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.filter = brightnessPctToFilter(pct);
}

function read(): number {
  if (typeof window === "undefined") return DEFAULT_BRIGHTNESS_PCT;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(BRIGHTNESS_STORAGE_KEY);
  } catch {
    return DEFAULT_BRIGHTNESS_PCT;
  }
  if (cached.raw === raw) return cached.value;
  const parsed = raw !== null ? Number.parseInt(raw, 10) : NaN;
  const value = Number.isFinite(parsed)
    ? clampBrightness(parsed)
    : DEFAULT_BRIGHTNESS_PCT;
  cached = { raw, value };
  return value;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(l: Listener) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === BRIGHTNESS_STORAGE_KEY) {
      applyToDom(read());
      l();
    }
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

function write(next: number) {
  const clamped = clampBrightness(next);
  const asStr = String(clamped);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(BRIGHTNESS_STORAGE_KEY, asStr);
    } catch {
      /* quota / disabled — in-memory + DOM still updated */
    }
  }
  cached = { raw: asStr, value: clamped };
  applyToDom(clamped);
  for (const l of listeners) l();
}

export interface BrightnessState {
  pct: number;
  setBrightness: (pct: number) => void;
}

export function useBrightness(): BrightnessState {
  const pct = useSyncExternalStore(
    subscribe,
    read,
    () => DEFAULT_BRIGHTNESS_PCT,
  );
  const setBrightness = useCallback((next: number) => write(next), []);
  return { pct, setBrightness };
}
