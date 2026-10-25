// LocalStorage persistence for the Workspace V8 pixel canvas.
//
// V8 (FRONTEND-TRADE-WIDGET-V1) bumps the layout version so any V7
// bucket that still carries the legacy `option-details` widget type
// is dropped on load and the workspace reseeds the default — which
// now ships the renamed `trade` widget. The V7 strict per-widget
// validation introduced in the previous milestone is unchanged.
//
// Safety guarantees enforced by this module:
//   - never writes secrets, RPC URLs, private keys, bearer tokens,
//     DATABASE_URL, or signatures.
//   - never blocks SSR — every `window.localStorage` access is guarded.
//   - prunes expired buckets on load.
//   - re-initialises corrupted / wrong-version / invalid-geometry buckets.
//   - normalises wallet addresses to lower-case.

import {
  ANON_LAYOUT_TTL_MS,
  ANON_WALLET_KEY,
  WALLET_LAYOUT_TTL_MS,
  WORKSPACE_LAYOUT_VERSION,
  WORKSPACE_STORAGE_PREFIX,
  isValidWorkspaceLayout,
  type StoredWorkspaces,
  type WorkspaceId,
  type WorkspaceLayout,
} from "./workspace-types";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Browser storage may be denied even when the property exists.
  }
}

function workspaceKeys(): string[] {
  try {
    const store = storage();
    if (!store) return [];
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(WORKSPACE_STORAGE_PREFIX)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

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

export function loadBucket(walletKey: string): StoredWorkspaces {
  const raw = read(storageKeyFor(walletKey));
  if (!raw) return emptyBucket(walletKey);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    remove(storageKeyFor(walletKey));
    return emptyBucket(walletKey);
  }
  if (!isStoredWorkspaces(parsed) || parsed.version !== WORKSPACE_LAYOUT_VERSION) {
    remove(storageKeyFor(walletKey));
    return emptyBucket(walletKey);
  }
  if (parsed.walletKey !== walletKey) {
    remove(storageKeyFor(walletKey));
    return emptyBucket(walletKey);
  }
  const now = nowMs();
  const kept: Partial<Record<WorkspaceId, WorkspaceLayout>> = {};
  let droppedAny = false;
  for (const [wid, layout] of Object.entries(parsed.workspaces)) {
    if (!layout) continue;
    if (typeof layout.expiresAt !== "number" || layout.expiresAt <= now) {
      droppedAny = true;
      continue;
    }
    if (!isValidWorkspaceLayout(layout)) {
      // Geometry / shape failed strict validation — drop just this
      // workspace, keep the rest of the bucket valid.
      droppedAny = true;
      continue;
    }
    kept[wid as WorkspaceId] = layout;
  }
  if (droppedAny) {
    const cleaned: StoredWorkspaces = {
      version: WORKSPACE_LAYOUT_VERSION,
      walletKey,
      workspaces: kept,
    };
    write(storageKeyFor(walletKey), JSON.stringify(cleaned));
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
  canvasWidthPx: number,
  canvasHeightPx: number,
): WorkspaceLayout | null {
  if (!storage()) return null;
  // Refuse to persist a layout while the canvas is still measuring —
  // saving zero canvas dimensions would let `findFreeSlot` and other
  // helpers see (0, 0) on next load before ResizeObserver fires.
  if (
    !Number.isFinite(canvasWidthPx) ||
    !Number.isFinite(canvasHeightPx) ||
    canvasWidthPx <= 0 ||
    canvasHeightPx <= 0
  ) {
    return null;
  }
  const bucket = loadBucket(walletKey);
  const now = nowMs();
  const layout: WorkspaceLayout = {
    workspaceId,
    widgets,
    canvasWidthPx,
    canvasHeightPx,
    updatedAt: now,
    expiresAt: now + defaultTtl(walletKey),
  };
  bucket.workspaces[workspaceId] = layout;
  if (!write(storageKeyFor(walletKey), JSON.stringify(bucket))) return null;
  return layout;
}

export function resetWorkspaceLayout(
  walletKey: string,
  workspaceId: WorkspaceId,
): void {
  if (!storage()) return;
  const bucket = loadBucket(walletKey);
  delete bucket.workspaces[workspaceId];
  write(storageKeyFor(walletKey), JSON.stringify(bucket));
}

/** Recovery helper: wipe every workspace layout bucket under our
 *  prefix, for every wallet stored on this device. Exposed for
 *  manual console use (`__deoptClearWorkspaceLayouts()`); no UI
 *  surface in the terminal. */
export function clearWorkspaceLayouts(): number {
  const keys = workspaceKeys();
  for (const k of keys) {
    remove(k);
  }
  return keys.length;
}

/** Recovery helper scoped to a single workspace under the active
 *  wallet key. */
export function clearWorkspaceLayoutForWorkspace(
  walletKey: string,
  workspaceId: WorkspaceId,
): void {
  resetWorkspaceLayout(walletKey, workspaceId);
}

/** Prune expired buckets across every key under our prefix. Safe to
 *  call on app boot; idempotent. */
export function pruneExpiredLayouts(): void {
  const keysToCheck = workspaceKeys();
  const now = nowMs();
  for (const k of keysToCheck) {
    const raw = read(k);
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      remove(k);
      continue;
    }
    if (!isStoredWorkspaces(parsed) || parsed.version !== WORKSPACE_LAYOUT_VERSION) {
      remove(k);
      continue;
    }
    let anyKept = false;
    for (const [wid, layout] of Object.entries(parsed.workspaces)) {
      if (!layout) continue;
      if (typeof layout.expiresAt !== "number" || layout.expiresAt <= now) {
        delete parsed.workspaces[wid as WorkspaceId];
      } else if (!isValidWorkspaceLayout(layout)) {
        delete parsed.workspaces[wid as WorkspaceId];
      } else {
        anyKept = true;
      }
    }
    if (!anyKept) {
      remove(k);
    } else {
      write(k, JSON.stringify(parsed));
    }
  }
}
