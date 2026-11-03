import { NextRequest, NextResponse } from "next/server";
import { backend, noStore, unavailable } from "../../_shared";

const permitted = new Set(["health", "ready", "perps/markets"]);
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const relative = path.join("/");
  if (!permitted.has(relative) && !/^perps\/markets\/[0-9]+(?:\/price)?$/.test(relative)) {
    return new NextResponse(null, { status: 403, headers: noStore });
  }
  const result = await backend(`/${relative}`, { headers: { Accept: "application/json" } });
  if (!result) return unavailable();
  return new NextResponse(result.body, { status: result.status, headers: { ...noStore, "Content-Type": "application/json" } });
}
