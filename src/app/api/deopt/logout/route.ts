import { NextRequest, NextResponse } from "next/server";
import { backend, cookieName, noStore, requireSameOrigin } from "../_shared";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return new NextResponse(null, { status: 403, headers: noStore });
  const token = request.cookies.get(cookieName)?.value;
  const result = token && /^[a-f0-9]{64}$/.test(token)
    ? await backend("/auth/wallet/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
    : null;
  const response = new NextResponse(null, { status: result && !result.ok && result.status !== 401 ? 503 : 204, headers: noStore });
  response.cookies.set(cookieName, "", {
    httpOnly: true, secure: true, sameSite: "strict", path: "/api/deopt", maxAge: 0,
  });
  return response;
}
