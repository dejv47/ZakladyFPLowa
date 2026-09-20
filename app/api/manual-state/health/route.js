import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const hasUrl = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);
  return NextResponse.json({ ok: hasUrl && hasToken, hasUrl, hasToken }, { headers: { "Cache-Control": "no-store" } });
}
