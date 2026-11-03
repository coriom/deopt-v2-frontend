import { NextRequest, NextResponse } from "next/server";
import { backend, cookieName, noStore, unavailable, walletAddress } from "../_shared";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!walletAddress(wallet)) return new NextResponse(null, { status: 400, headers: noStore });
  const token = request.cookies.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return new NextResponse(null, { status: 401, headers: noStore });
  const result = await backend(`/accounts/${wallet}/perps/canonical-fees?limit=25`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!result) return unavailable();
  return new NextResponse(result.body, { status: result.status, headers: { ...noStore, "Content-Type": "application/json" } });
}
