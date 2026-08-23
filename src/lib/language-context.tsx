"use client";

// Language / locale state — module-scoped store subscribed to via
// `useSyncExternalStore`. Matches the pattern used by
// `useChainColumnPrefs` / `useOrderbookPrefs` in this codebase:
//
//   - Server + first client render always return DEFAULT_LOCALE, so
//     hydration is stable.
//   - After mount, the client snapshot picks up any persisted value
//     from localStorage.
//   - Cross-tab updates propagate through the `storage` event.

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LANGUAGE_STORAGE_KEY,
  isSupportedLocale,
} from "./language";

// Cache the last read value so `useSyncExternalStore` gets a stable
// reference between reads (React compares with `Object.is`).
let cached: { raw: string | null; value: string } = {
  raw: "<uninit>",
  value: DEFAULT_LOCALE,
};

function read(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return DEFAULT_LOCALE;
  }
  if (cached.raw === raw) return cached.value;
  const value = raw && isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
  cached = { raw, value };
  return value;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(l: Listener) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LANGUAGE_STORAGE_KEY) l();
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

function write(next: string) {
  if (!isSupportedLocale(next)) return;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* quota / disabled — silently ignore */
    }
  }
  cached = { raw: next, value: next };
  for (const l of listeners) l();
}

export interface LanguageState {
  language: string;
  setLanguage: (code: string) => void;
}

export function useLanguage(): LanguageState {
  const language = useSyncExternalStore(subscribe, read, () => DEFAULT_LOCALE);
  const setLanguage = useCallback((code: string) => write(code), []);
  return { language, setLanguage };
}
