// SUBACCOUNTS-FRONTEND-SWITCHER-V1 — active-subaccount persistence.
//
// UI-only preference. The backend is the source of truth for which
// subaccounts exist; localStorage remembers which one the operator
// last selected per wallet so a page reload lands on the same
// account. All access is guarded so SSR never touches
// `window.localStorage`.

const KEY_PREFIX = "deopt.subaccount.";

export const DEFAULT_SUBACCOUNT_ID = 1 as const;

function keyFor(address: string): string {
  return `${KEY_PREFIX}${address.toLowerCase()}`;
}

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read the persisted active subaccount for a wallet. Returns `null`
 * when nothing is stored, storage is unavailable, or the value is
 * corrupted. Never throws.
 */
export function readActiveSubaccountId(address: string): number | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  const raw = ls.getItem(keyFor(address));
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as { subaccountId?: unknown };
    const id = parsed.subaccountId;
    if (typeof id === "number" && Number.isFinite(id) && id >= 1) {
      return Math.floor(id);
    }
  } catch {
    // fall through to null
  }
  return null;
}

/**
 * Persist the active subaccount for a wallet. Silently no-ops when
 * storage is unavailable. Never throws.
 */
export function writeActiveSubaccountId(
  address: string,
  subaccountId: number,
): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(
      keyFor(address),
      JSON.stringify({
        subaccountId,
        lastUpdatedMs: Date.now(),
      }),
    );
  } catch {
    // storage quota etc — ignore.
  }
}

/**
 * Read `?subaccount=<N>` from the current URL, if any. Wallet
 * context uses this as a one-shot override that wins over the
 * localStorage value on initial load — matches Derive-style deep
 * linking.
 */
export function readSubaccountFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("subaccount");
    if (raw == null) return null;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) {
      return n;
    }
  } catch {
    // ignore
  }
  return null;
}

// Exported for tests only — the `deopt.subaccount.<address>` prefix
// is part of the persistence contract.
export const __SUBACCOUNT_STORAGE_KEY_PREFIX = KEY_PREFIX;
