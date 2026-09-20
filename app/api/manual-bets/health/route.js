import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!url && projectRef) url = `https://${projectRef}.supabase.co`;
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

  const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAnon = Boolean(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let host = null;
  try { host = url ? new URL(url).host : null; } catch {}

  return NextResponse.json(
    {
      ok: Boolean(url && (hasService || hasAnon)),
      hasUrl: Boolean(url),
      supabaseHost: host,
      hasServiceKey: hasService,
      hasAnonKey: hasAnon
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
