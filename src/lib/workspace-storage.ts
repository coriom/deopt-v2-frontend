// LocalStorage persistence for the Workspace V1 system.
//
// Safety guarantees enforced by this module:
//   - never writes secrets, RPC URLs, private keys, bearer tokens,
//     DATABASE_URL, or signatures.
//   - never blocks SSR — every `window.localStorage` access is guarded.
//   - prunes expired buckets on load.
//   - re-initialises corrupted / wrong-version buckets.
//   - normalises wallet addresses to lower-case.

import {
  ANON_LAYOUT_TTL_MS,
  ANON_WALLET_KEY,
  WALLET_LAYOUT_TTL_MS,
  WORKSPACE_LAYOUT_VERSION,
  WORKSPACE_STORAGE_PREFIX,
  type StoredWorkspaces,
  type WorkspaceId,
  type WorkspaceLayout,
} from "./workspace-types";

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

/** Convert a wallet address to the storage key segment. `null` → `anon`. */
export function walletKeyFor(address: string | null): string {
  if (!address) return ANON_WALLET_KEY;
  const trimmed = address.trim();
  if (!trimmed.startsWith("0x") || trimmed.length !== 42) return ANON_WALLET_KEY;
  return trimmed.toLowerCase();
}

export function storageKeyFor(walletKey: string): string {
  return `${WORKSPACE_STORAGE_PREFIX}${walletKey}`;
}

function defaultTtl(walletKey: string): number {
  return walletKey === ANON_WALLET_KEY ? ANON_LAYOUT_TTL_MS : WALLET_LAYOUT_TTL_MS;
}

function nowMs(): number {
  return Date.now();
}

/** Returns a fresh empty bucket. */
function emptyBucket(walletKey: string): StoredWorkspaces {
  return {
    version: WORKSPACE_LAYOUT_VERSION,
    walletKey,
    workspaces: {},
  };
}

function isStoredWorkspaces(value: unknown): value is StoredWorkspaces {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.version === "number" &&
    typeof o.walletKey === "string" &&
    typeof o.workspaces === "object" &&
    o.workspaces !== null
  );
}

/** Load the entire bucket for `walletKey`, pruning expired layouts and
 *  refusing to return any other wallet's data. */
export function loadBucket(walletKey: string): StoredWorkspaces {
  if (!isBrowser()) return emptyBucket(walletKey);
  const raw = window.localStorage.getItem(storageKeyFor(walletKey));
  if (!raw) return emptyBucket(walletKey);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(storageKeyFor(walletKey));
    return emptyBucket(walletKey);
  }
  if (!isStoredWorkspaces(parsed) || parsed.version !== WORKSPACE_LAYOUT_VERSION) {
    window.localStorage.removeItem(storageKeyFor(walletKey));
    return emptyBucket(walletKey);
  }
  if (parsed.walletKey !== walletKey) {
    window.localStorage.removeItem(storageKeyFor(walletKey));
    return emptyBucket(walletKey);
  }
  const now = nowMs();
  const kept: Partial<Record<WorkspaceId, WorkspaceLayout>> = {};
  for (const [wid, layout] of Object.entries(parsed.workspaces)) {
    if (!layout) continue;
    if (typeof layout.expiresAt !== "number" || layout.expiresAt <= now) continue;
    kept[wid as WorkspaceId] = layout;
  }
  return {
    version: WORKSPACE_LAYOUT_VERSION,
    walletKey,
    workspaces: kept,
  };
}

export function loadWorkspaceLayout(
  walletKey: string,
  workspaceId: WorkspaceId,
): WorkspaceLayout | null {
  return loadBucket(walletKey).workspaces[workspaceId] ?? null;
}

export function saveWorkspaceLayout(
  walletKey: string,
  workspaceId: WorkspaceId,
  widgets: WorkspaceLayout["widgets"],
  cols: number,
): WorkspaceLayout | null {
  if (!isBrowser()) return null;
  const bucket = loadBucket(walletKey);
  const now = nowMs();
  const layout: WorkspaceLayout = {
    workspaceId,
    widgets,
    cols,
    updatedAt: now,
    expiresAt: now + defaultTtl(walletKey),
  };
  bucket.workspaces[workspaceId] = layout;
  try {
    window.localStorage.setItem(
      storageKeyFor(walletKey),
      JSON.stringify(bucket),
    );
  } catch {
    // Storage quota / disabled — silently fall back to in-memory.
    return null;
  }
  return layout;
}

export function resetWorkspaceLayout(
  walletKey: string,
  workspaceId: WorkspaceId,
): void {
  if (!isBrowser()) return;
  const bucket = loadBucket(walletKey);
  delete bucket.workspaces[workspaceId];
  try {
    window.localStorage.setItem(
      storageKeyFor(walletKey),
      JSON.stringify(bucket),
    );
  } catch {
    // ignore
  }
}

/** Prune expired buckets across every key under our prefix. Safe to
 *  call on app boot; idempotent. */
export function pruneExpiredLayouts(): void {
  if (!isBrowser()) return;
  const keysToCheck: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(WORKSPACE_STORAGE_PREFIX)) keysToCheck.push(k);
  }
  const now = nowMs();
  for (const k of keysToCheck) {
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(k);
      continue;
    }
    if (!isStoredWorkspaces(parsed) || parsed.version !== WORKSPACE_LAYOUT_VERSION) {
      window.localStorage.removeItem(k);
      continue;
    }
    let anyKept = false;
    for (const [wid, layout] of Object.entries(parsed.workspaces)) {
      if (!layout) continue;
      if (typeof layout.expiresAt !== "number" || layout.expiresAt <= now) {
        delete parsed.workspaces[wid as WorkspaceId];
      } else {
        anyKept = true;
      }
    }
    if (!anyKept) {
      window.localStorage.removeItem(k);
    } else {
      try {
        window.localStorage.setItem(k, JSON.stringify(parsed));
      } catch {
        // ignore
      }
    }
  }
}
