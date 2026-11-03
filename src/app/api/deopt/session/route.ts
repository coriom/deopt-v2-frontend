import { NextRequest, NextResponse } from "next/server";
import { backend, cookieName, noStore, unavailable, walletAddress } from "../_shared";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return new NextResponse(null, { status: 401, headers: noStore });
  const result = await backend("/auth/wallet/session", { headers: { Authorization: `Bearer ${token}` } });
  if (!result) return unavailable();
  if (!result.ok) return new NextResponse(null, { status: result.status, headers: noStore });
  const data = await result.json().catch(() => null);
  if (!walletAddress(data?.wallet)) return unavailable();
  return NextResponse.json({ wallet: data.wallet }, { headers: noStore });
}
