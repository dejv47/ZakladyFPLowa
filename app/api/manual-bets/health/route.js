import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAnon = Boolean(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return NextResponse.json(
    { ok: Boolean(url && (hasService || hasAnon)), hasUrl: Boolean(url), hasServiceKey: hasService, hasAnonKey: hasAnon },
    { headers: { "Cache-Control": "no-store" } }
  );
}
