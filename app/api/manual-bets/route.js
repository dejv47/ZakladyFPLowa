import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supabase = client();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Brak konfiguracji Supabase." }, { status: 500 });
    }
    const { data, error } = await supabase.from("manual_bets").select("bet_id,data");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rows: data || [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "Błąd odczytu." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = client();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Brak konfiguracji Supabase na serwerze." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const betId = Number(body?.betId);
    if (!Number.isInteger(betId) || betId <= 0 || !body?.data || typeof body.data !== "object") {
      return NextResponse.json({ ok: false, error: "Nieprawidłowe dane zakładu." }, { status: 400 });
    }

    const { error } = await supabase
      .from("manual_bets")
      .upsert(
        { bet_id: betId, data: body.data, updated_at: new Date().toISOString() },
        { onConflict: "bet_id" }
      );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Nie udało się zapisać wyniku." },
      { status: 500 }
    );
  }
}
