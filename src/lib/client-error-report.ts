import {
  fingerprintOf,
  safeErrorType,
  safeRoute,
  type ClientErrorRecord,
  type ErrorCategory,
  type ErrorSource,
} from "./client-error-schema";

const ENDPOINT = "/api/client-errors";
const RECENT_MS = 5 * 60_000;
const MAX_PER_MINUTE = 5;
const MAX_PER_PAGE = 20;
const recent = new Map<string, number>();
let minuteStart = 0;
let minuteCount = 0;
let pageCount = 0;

function coarseBrowser(): ClientErrorRecord["browser"] {
  const agent = navigator.userAgent;
  if (/Firefox\//.test(agent)) return "firefox";
  if (/Chrome\/|Chromium\/|Edg\//.test(agent)) return "chromium";
  if (/Safari\//.test(agent)) return "safari";
  return "other";
}

function commitSha(): string {
  const value = process.env.NEXT_PUBLIC_DEOPT_COMMIT ?? "unknown";
  return /^[a-f0-9]{40}$/.test(value) ? value : "unknown";
}

function shouldIgnoreExternalStack(error: unknown): boolean {
  if (!(error instanceof Error) || typeof error.stack !== "string") return false;
  return /(?:chrome|moz|safari)-extension:\/\/|tradingview\.com\//i.test(error.stack);
}

export function reportClientError(
  category: ErrorCategory,
  error: unknown,
  source: ErrorSource,
): void {
  try {
    if (typeof window === "undefined" || shouldIgnoreExternalStack(error)) return;
    const now = Date.now();
    if (pageCount >= MAX_PER_PAGE) return;
    if (now - minuteStart >= 60_000) {
      minuteStart = now;
      minuteCount = 0;
    }
    if (minuteCount >= MAX_PER_MINUTE) return;
    const route = safeRoute(window.location.pathname);
    const type = safeErrorType(error instanceof Error ? error.name : undefined);
    const fingerprint = fingerprintOf(category, type, source, route);
    if (now - (recent.get(fingerprint) ?? 0) < RECENT_MS) return;
    if (recent.size >= 32) recent.clear();
    recent.set(fingerprint, now);
    minuteCount++;
    pageCount++;

    const record: ClientErrorRecord = {
      v: 1,
      category,
      type,
      source,
      route,
      fingerprint,
      commit: commitSha(),
      browser: coarseBrowser(),
      timestamp: now,
    };
    // Never serialize error, message, stack, URL, wallet state or storage.
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
      cache: "no-store",
      credentials: "omit",
      keepalive: true,
      mode: "same-origin",
      referrerPolicy: "no-referrer",
    }).catch(() => {});
  } catch {
    // Monitoring must never become a second application failure.
  }
}

export function installClientErrorListeners(): void {
  try {
    window.addEventListener("error", (event: Event) => {
      if (event instanceof ErrorEvent) {
        if (event.filename) {
          try {
            if (new URL(event.filename, location.href).origin !== location.origin) return;
          } catch {
            return;
          }
        }
        const category: ErrorCategory =
          /hydration failed|text content does not match|hydrating/i.test(event.message)
            ? "hydration"
            : "javascript";
        reportClientError(category, event.error, "window");
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLScriptElement || target instanceof HTMLLinkElement)) return;
      const resource = target instanceof HTMLScriptElement ? target.src : target.href;
      try {
        const url = new URL(resource);
        if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) {
          reportClientError("asset", new Error("asset failed"), "next-asset");
        }
      } catch {
        // Ignore malformed and third-party resource references.
      }
    }, true);
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason instanceof Error) {
        reportClientError("promise", event.reason, "unhandled-rejection");
      }
    });
  } catch {
    // A browser extension may patch global event APIs; leave the app usable.
  }
}
