// Only these fixed fields may leave the browser. In particular, error
// messages, stacks, URLs, wallet state, and storage values are excluded.
export const ERROR_CATEGORIES = [
  "javascript",
  "promise",
  "react",
  "hydration",
  "asset",
] as const;
export const ERROR_SOURCES = [
  "window",
  "unhandled-rejection",
  "react-segment",
  "react-root",
  "next-asset",
] as const;
export const ERROR_TYPES = [
  "Error",
  "TypeError",
  "ReferenceError",
  "RangeError",
  "SyntaxError",
  "SecurityError",
  "NetworkError",
  "UnknownError",
] as const;
export const BROWSERS = ["chromium", "firefox", "safari", "other"] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];
export type ErrorSource = (typeof ERROR_SOURCES)[number];
export type ErrorType = (typeof ERROR_TYPES)[number];
export type CoarseBrowser = (typeof BROWSERS)[number];

const ROUTES = new Set([
  "/", "/admin", "/api", "/custom", "/docs", "/feedback",
  "/fees", "/fundings", "/health", "/history", "/leaderboard",
  "/options", "/perps", "/portfolio", "/rfq-strategy", "/settings",
  "/trade", "/transactions", "/window",
]);

export interface ClientErrorRecord {
  v: 1;
  category: ErrorCategory;
  type: ErrorType;
  source: ErrorSource;
  route: string;
  fingerprint: string;
  commit: string;
  browser: CoarseBrowser;
  timestamp: number;
}

export function safeRoute(pathname: string): string {
  const segment = pathname.split("/")[1];
  const route = segment ? `/${segment}` : "/";
  return ROUTES.has(route) ? route : "/other";
}

export function safeErrorType(value: unknown): ErrorType {
  return typeof value === "string" &&
    (ERROR_TYPES as readonly string[]).includes(value)
    ? (value as ErrorType)
    : "UnknownError";
}

export function fingerprintOf(
  category: ErrorCategory,
  type: ErrorType,
  source: ErrorSource,
  route: string,
): string {
  // FNV-1a is a grouping key, not a cryptographic or user identity hash.
  const input = `${category}|${type}|${source}|${route}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function parseClientErrorRecord(value: unknown, now = Date.now()): ClientErrorRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const keys = ["v", "category", "type", "source", "route", "fingerprint", "commit", "browser", "timestamp"];
  if (Object.keys(item).length !== keys.length || keys.some((key) => !(key in item))) return null;
  if (item.v !== 1 || typeof item.category !== "string" ||
      !(ERROR_CATEGORIES as readonly string[]).includes(item.category)) return null;
  if (typeof item.type !== "string" || !(ERROR_TYPES as readonly string[]).includes(item.type)) return null;
  if (typeof item.source !== "string" || !(ERROR_SOURCES as readonly string[]).includes(item.source)) return null;
  if (typeof item.route !== "string" || !ROUTES.has(item.route) && item.route !== "/other") return null;
  if (typeof item.browser !== "string" || !(BROWSERS as readonly string[]).includes(item.browser)) return null;
  if (typeof item.commit !== "string" || !/^(?:[a-f0-9]{40}|unknown)$/.test(item.commit)) return null;
  if (typeof item.timestamp !== "number" || !Number.isInteger(item.timestamp) ||
      Math.abs(now - item.timestamp) > 10 * 60_000) return null;
  const fingerprint = fingerprintOf(
    item.category as ErrorCategory, item.type as ErrorType,
    item.source as ErrorSource, item.route,
  );
  if (item.fingerprint !== fingerprint) return null;
  return item as unknown as ClientErrorRecord;
}
