import { NextRequest, NextResponse } from "next/server";
import { backend, noStore, requireSameOrigin, unavailable, walletAddress } from "../_shared";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return new NextResponse(null, { status: 403, headers: noStore });
  const body = await request.json().catch(() => null);
  if (!walletAddress(body?.address)) return new NextResponse(null, { status: 400, headers: noStore });
  const result = await backend("/auth/wallet/challenge", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: body.address }),
  });
  if (!result) return unavailable();
  return new NextResponse(result.body, { status: result.status, headers: { ...noStore, "Content-Type": "application/json" } });
}
