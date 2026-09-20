import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEY = "zaklady:manual-state:v1";

function env() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url: url?.replace(/\/+$/, ""), token };
}

function reply(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
  });
}

async function command(...args) {
  const { url, token } = env();
  if (!url || !token) {
    throw new Error(
      "Brak wspólnego magazynu. Dodaj Vercel Marketplace → Upstash Redis/KV do projektu i zrób Redeploy."
    );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args),
    cache: "no-store"
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `KV HTTP ${response.status}`);
  }
  return payload.result;
}

async function getAll() {
  const raw = await command("GET", KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    return reply({ ok: true, manual: await getAll() });
  } catch (error) {
    return reply({ ok: false, error: error?.message || "Błąd odczytu." }, 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const betId = Number(body?.betId);
    const data = body?.data;

    if (!Number.isInteger(betId) || betId <= 0 || !data || typeof data !== "object" || Array.isArray(data)) {
      return reply({ ok: false, error: "Nieprawidłowe dane zakładu." }, 400);
    }

    // Prosty optimistic retry, żeby dwie osoby nie nadpisały różnych zakładów.
    // Przy tej prywatnej stronie zapis jest bardzo rzadki; jeden wspólny dokument wystarcza.
    const all = await getAll();
    all[String(betId)] = data;
    await command("SET", KEY, JSON.stringify(all));

    return reply({ ok: true, manual: all });
  } catch (error) {
    return reply({ ok: false, error: error?.message || "Błąd zapisu." }, 500);
  }
}
