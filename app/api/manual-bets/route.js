import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url: url?.replace(/\/+$/, ""), key };
}

function noStore(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
  });
}

async function supabaseRest(path, options = {}) {
  const { url, key } = config();
  if (!url || !key) {
    throw new Error(
      "Brak konfiguracji Supabase w Vercel. Ustaw SUPABASE_URL (lub NEXT_PUBLIC_SUPABASE_URL) oraz SUPABASE_SERVICE_ROLE_KEY albo NEXT_PUBLIC_SUPABASE_ANON_KEY i zrób Redeploy."
    );
  }

  let response;
  try {
    response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(`Serwer Vercel nie może połączyć się z Supabase: ${error?.message || "fetch failed"}`);
  }

  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

  if (!response.ok) {
    const detail =
      payload?.message ||
      payload?.details ||
      payload?.hint ||
      (typeof payload === "string" ? payload : null) ||
      `HTTP ${response.status}`;
    throw new Error(`Supabase REST ${response.status}: ${detail}`);
  }
  return payload;
}

export async function GET() {
  try {
    const rows = await supabaseRest("manual_bets?select=bet_id,data&order=bet_id.asc", {
      method: "GET"
    });
    return noStore({ ok: true, rows: rows || [] });
  } catch (error) {
    return noStore({ ok: false, error: error?.message || "Błąd odczytu manual_bets." }, 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const betId = Number(body?.betId);
    const data = body?.data;

    if (!Number.isInteger(betId) || betId <= 0 || !data || typeof data !== "object" || Array.isArray(data)) {
      return noStore({ ok: false, error: "Nieprawidłowe dane zakładu." }, 400);
    }

    await supabaseRest("manual_bets?on_conflict=bet_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        bet_id: betId,
        data,
        updated_at: new Date().toISOString()
      })
    });

    return noStore({ ok: true });
  } catch (error) {
    return noStore({ ok: false, error: error?.message || "Nie udało się zapisać wyniku." }, 500);
  }
}
