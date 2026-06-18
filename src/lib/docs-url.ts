// FRONTEND-DOCS-SPLIT-V1 — single source of truth for the docs site
// base URL. Falls back to the local dev port so running both apps
// side-by-side just works. Never hardcoded to any production host.
//
// Default is 3002 (not 3001) because `next dev` for this terminal
// may fall through to 3001 when 3000 is busy — using 3001 here
// would collide with the terminal's overflow port. The docs site's
// own `npm run dev` binds to 3002 to match.

export function docsBaseUrl(): string {
  if (typeof process !== "undefined") {
    const v = process.env.NEXT_PUBLIC_DOCS_URL;
    if (v && v.length > 0) return v.replace(/\/$/, "");
  }
  return "http://localhost:3002";
}

export function docsPath(path: string): string {
  const base = docsBaseUrl();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}
