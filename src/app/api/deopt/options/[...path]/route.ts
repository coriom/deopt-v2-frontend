import { NextRequest, NextResponse } from "next/server";
import { backend, cookieName, noStore, unavailable, walletAddress } from "../../_shared";

// Narrow bridge for a future read-only Options release. A wallet address in
// the URL is never treated as authorization: Rust checks the session too.
function allowedPath(parts: string[]): { path: string; privateRead: boolean } | null {
  if (parts[0] === "options") {
    if (parts.length === 2 && parts[1] === "products") {
      return { path: "/options/products", privateRead: false };
    }
    if (parts.length === 3 && parts[1] === "products" && /^0x[0-9a-fA-F]{64}$/.test(parts[2])) {
      return { path: `/options/products/${parts[2]}`, privateRead: false };
    }
    if (parts.length === 4 && parts[1] === "series" && /^[a-zA-Z0-9_-]{1,80}$/.test(parts[2])
        && parts[3] === "details") {
      return { path: `/options/series/${parts[2]}/details`, privateRead: false };
    }
  }
  if (parts[0] === "accounts" && walletAddress(parts[1] ?? null)) {
    const suffix = parts.slice(2).join("/");
    if (["positions", "physical-positions", "portfolio", "balances", "history", "history/v2"].includes(suffix)) {
      return { path: `/accounts/${parts[1]}/${suffix}`, privateRead: true };
    }
  }
  return null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const selected = allowedPath(path);
  if (!selected) return new NextResponse(null, { status: 403, headers: noStore });

  const token = selected.privateRead ? request.cookies.get(cookieName)?.value : undefined;
  if (selected.privateRead && (!token || !/^[a-f0-9]{64}$/.test(token))) {
    return new NextResponse(null, { status: 401, headers: noStore });
  }
  const query = request.nextUrl.search;
  const result = await backend(selected.path + query, {
    headers: {
      Accept: "application/json",
      ...(selected.privateRead ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!result) return unavailable();
  return new NextResponse(result.body, {
    status: result.status,
    headers: { ...noStore, "Content-Type": "application/json" },
  });
}
