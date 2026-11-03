import { NextRequest, NextResponse } from "next/server";

export const cookieName = "deopt_wallet_read";
export const noStore = { "Cache-Control": "no-store, private" };

export function requireSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin === "https://deoptv2-frontend.vercel.app") return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin ?? "");
}

export function unavailable() {
  return NextResponse.json({ error: "DeOpt read-only API unavailable" }, { status: 503, headers: noStore });
}

export function upstreamUrl(path: string): URL | null {
  const value = process.env.DEOPT_BACKEND_HTTPS_ORIGIN;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return new URL(path, url);
  } catch { return null; }
}

export async function backend(path: string, init: RequestInit = {}): Promise<Response | null> {
  const url = upstreamUrl(path);
  if (!url) return null;
  try {
    return await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5_000) });
  } catch { return null; }
}

export function walletAddress(value: string | null): value is string {
  return !!value && /^0x[0-9a-fA-F]{40}$/.test(value);
}
