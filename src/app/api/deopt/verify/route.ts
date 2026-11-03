import { NextRequest, NextResponse } from "next/server";
import { backend, cookieName, noStore, requireSameOrigin, unavailable, walletAddress } from "../_shared";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return new NextResponse(null, { status: 403, headers: noStore });
  const body = await request.json().catch(() => null);
  if (typeof body?.nonce !== "string" || !/^[a-f0-9]{32}$/.test(body.nonce)
      || typeof body?.signature !== "string" || !/^0x[a-fA-F0-9]{130}$/.test(body.signature)) {
    return new NextResponse(null, { status: 400, headers: noStore });
  }
  const result = await backend("/auth/wallet/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonce: body.nonce, signature: body.signature }),
  });
  if (!result) return unavailable();
  if (!result.ok) return new NextResponse(null, { status: result.status, headers: noStore });
  const verified = await result.json().catch(() => null);
  if (!walletAddress(verified?.wallet) || typeof verified?.token !== "string"
      || !/^[a-f0-9]{64}$/.test(verified.token)
      || !Number.isSafeInteger(verified?.expires_at_ms)) return unavailable();
  const maxAge = Math.max(0, Math.min(900, Math.floor((verified.expires_at_ms - Date.now()) / 1000)));
  if (maxAge === 0) return unavailable();
  const response = NextResponse.json({ wallet: verified.wallet }, { headers: noStore });
  response.cookies.set(cookieName, verified.token, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/api/deopt", maxAge,
  });
  return response;
}
