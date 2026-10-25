import { parseClientErrorRecord } from "@/lib/client-error-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 512;
const MAX_PER_MINUTE_PER_INSTANCE = 30;
let windowStart = 0;
let accepted = 0;

async function boundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function POST(request: Request): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.toLowerCase();
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host.toLowerCase() : null;
  } catch {
    return new Response(null, { status: 403, headers });
  }
  if (!host || originHost !== host ||
      ![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))) {
    return new Response(null, { status: 403, headers });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return new Response(null, { status: 415, headers });
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES) {
    return new Response(null, { status: 413, headers });
  }
  let value: unknown;
  try {
    const text = await boundedBody(request);
    if (text === null) return new Response(null, { status: 413, headers });
    value = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400, headers });
  }
  const record = parseClientErrorRecord(value);
  if (!record) return new Response(null, { status: 400, headers });
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    accepted = 0;
  }
  if (accepted >= MAX_PER_MINUTE_PER_INSTANCE) {
    return new Response(null, { status: 429, headers });
  }
  accepted++;
  // Fixed schema only. Never log request headers, cookies, raw URL or input.
  console.error("deopt_client_error", JSON.stringify(record));
  return new Response(null, { status: 204, headers });
}
