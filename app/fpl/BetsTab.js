"use client";

import { useEffect, useMemo, useState } from "react";
import { bets } from "../../lib/bets";

function money(n) {
  return `${n.toFixed(2).replace(".", ",")} zł`;
}

function defaultsFor(type) {
  if (type === "resovia") {
    return { status: "Trwa", note: "" };
  }
  if (type === "sesko-watkins") {
    return { seskoGoals: 0, seskoAssists: 0, watkinsGoals: 0, watkinsAssists: 0 };
  }
  if (type === "fpl") return { dejv: 0, radek: 0, note: "" };
  if (type === "cherki-mbeumo") return { cherkiGoals: 0, cherkiAssists: 0, mbeumoGoals: 0, mbeumoAssists: 0 };
  if (type === "cherki-minutes") return { minutes: 0 };
  return {};
}

function manualText(type, value) {
  const v = { ...defaultsFor(type), ...(value || {}) };

  if (type === "resovia") {
    return v.note ? `${v.status} • ${v.note}` : v.status;
  }

  if (type === "sesko-watkins") {
    const s = Number(v.seskoGoals || 0) + Number(v.seskoAssists || 0);
    const w = Number(v.watkinsGoals || 0) + Number(v.watkinsAssists || 0);
    return `Benjamin Šeško: ${v.seskoGoals || 0}G + ${v.seskoAssists || 0}A = ${s} G+A — Ollie Watkins: ${v.watkinsGoals || 0}G + ${v.watkinsAssists || 0}A = ${w} G+A`;
  }

  if (type === "fpl") {
    return `Dejv: ${v.dejv || 0} pkt — Radek: ${v.radek || 0} pkt${v.note ? ` • ${v.note}` : ""}`;
  }

  if (type === "cherki-mbeumo") { const c=Number(v.cherkiGoals||0)+Number(v.cherkiAssists||0), m=Number(v.mbeumoGoals||0)+Number(v.mbeumoAssists||0); return `Rayan Cherki: ${v.cherkiGoals||0}G + ${v.cherkiAssists||0}A = ${c} G+A — Bryan Mbeumo: ${v.mbeumoGoals||0}G + ${v.mbeumoAssists||0}A = ${m} G+A`; }
  if (type === "cherki-minutes") { const minutes=Math.max(0,Number(v.minutes||0)); return `Rayan Cherki: ${minutes}/2000 min • pozostało ${Math.max(0,2000-minutes)} min`; }
  return "Ręczne rozliczenie";
}

function manualLeader(type, value) {
  const v = { ...defaultsFor(type), ...(value || {}) };

  if (type === "sesko-watkins") {
    const s = Number(v.seskoGoals || 0) + Number(v.seskoAssists || 0);
    const w = Number(v.watkinsGoals || 0) + Number(v.watkinsAssists || 0);
    if (s > w) return "Dejv";
    if (w > s) return "Kuchnia";
    return "Remis";
  }

  if (type === "fpl") {
    const d = Number(v.dejv || 0);
    const r = Number(v.radek || 0);
    if (d > r) return "Dejv";
    if (r > d) return "Radek";
    return "Remis";
  }

  if (type === "resovia") {
    const status = String(v.status || "").toLowerCase();
    if (status.includes("nie awansuje") || status.startsWith("nie —")) return "Pachana";
    if (status.includes("awansuje") || status.startsWith("tak —")) return "Łukaszek";
    return null;
  }

  if (type === "cherki-minutes") return Number(v.minutes||0)>=2000 ? "Dejv" : "Janek";
  if (type === "cherki-mbeumo") { const c=Number(v.cherkiGoals||0)+Number(v.cherkiAssists||0), m=Number(v.mbeumoGoals||0)+Number(v.mbeumoAssists||0); return c>m?"Dejv":m>c?"Rudy":"Remis"; }
  return null;
}

const MANUAL_STORAGE_KEY = "zaklady-manual-v1";

function readManualStorage() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(MANUAL_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeManualStorage(all) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(all || {}));
}

async function sharedManualRequest(options = {}) {
  const response = await fetch("/api/manual-state", {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Błąd zapisu HTTP ${response.status}`);
  }
  return payload;
}

async function saveManualBet(betId, data) {
  // Natychmiastowy lokalny zapis jako cache, ale źródłem wspólnym jest KV na serwerze.
  const all = readManualStorage();
  all[String(betId)] = data;
  writeManualStorage(all);

  await sharedManualRequest({
    method: "POST",
    body: JSON.stringify({ betId: Number(betId), data })
  });
  return { ok: true };
}

function BetFlagsControl({ betId, value, onSaved }) {
  const settled = Boolean(value?.settled);
  const cancelled = Boolean(value?.cancelled);
  const [msg, setMsg] = useState("");

  async function patch(data) {
    try {
      await saveManualBet(betId, data);
      onSaved?.(betId, data);
      setMsg("Zapisano");
      window.setTimeout(() => setMsg(""), 1200);
    } catch (error) {
      setMsg(error?.message || "Nie udało się zapisać.");
    }
  }

  return (
    <div className="settledControl">
      <span className="sectionLabel">ROZLICZONY?</span>
      <div className="settledButtons">
        <button
          type="button"
          className={settled ? "settledActive" : ""}
          onClick={() => patch({ ...(value || {}), settled: !settled })}
        >
          {settled ? "TAK ✓" : "TAK"}
        </button>
      </div>

      <div className="cancelBetRow">
        {!cancelled ? (
          <button type="button" className="cancelBetBtn" onClick={() => patch({ ...(value || {}), cancelled: true })}>
            ANULUJ ZAKŁAD
          </button>
        ) : (
          <>
            <span className="cancelledBetText">ZAKŁAD ANULOWANY</span>
            <button type="button" className="restoreBetBtn" onClick={() => patch({ ...(value || {}), cancelled: false })}>
              Cofnij anulowanie
            </button>
          </>
        )}
        {msg && <small>{msg}</small>}
      </div>
    </div>
  );
}

function ManualEditor({ betId, type, value, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...defaultsFor(type), ...(value || {}) });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setForm({ ...defaultsFor(type), ...(value || {}) });
  }, [type, value]);

  async function save() {
    setSaving(true);
    setMsg("");

    try {
      await saveManualBet(betId, form);

      setMsg("Zapisano");
      setEditing(false);
      onSaved?.(betId, form);
    } catch (error) {
      setMsg(error?.message || "Nie udało się zapisać wyniku.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button className="editBtn" type="button" onClick={() => setEditing(true)}>
        Edytuj wynik
      </button>
    );
  }

  return (
    <div className="editor">
      {type === "sesko-watkins" && (
        <>
          <div className="editorGroup">
            <strong>Benjamin Šeško</strong>
            <label>Gole<input type="number" min="0" value={form.seskoGoals ?? 0} onChange={e => setForm({ ...form, seskoGoals: Number(e.target.value) })} /></label>
            <label>Asysty<input type="number" min="0" value={form.seskoAssists ?? 0} onChange={e => setForm({ ...form, seskoAssists: Number(e.target.value) })} /></label>
          </div>

          <div className="editorGroup">
            <strong>Ollie Watkins</strong>
            <label>Gole<input type="number" min="0" value={form.watkinsGoals ?? 0} onChange={e => setForm({ ...form, watkinsGoals: Number(e.target.value) })} /></label>
            <label>Asysty<input type="number" min="0" value={form.watkinsAssists ?? 0} onChange={e => setForm({ ...form, watkinsAssists: Number(e.target.value) })} /></label>
          </div>
        </>
      )}

      {type === "fpl" && (
        <div className="editorGroup">
          <label>Dejv — pkt<input type="number" min="0" value={form.dejv ?? 0} onChange={e => setForm({ ...form, dejv: Number(e.target.value) })} /></label>
          <label>Radek — pkt<input type="number" min="0" value={form.radek ?? 0} onChange={e => setForm({ ...form, radek: Number(e.target.value) })} /></label>
          <label className="wide">Uwagi<input type="text" value={form.note ?? ""} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
        </div>
      )}
{type === "cherki-mbeumo" && (<><div className="editorGroup"><strong>Rayan Cherki</strong><label>Gole<input type="number" min="0" value={form.cherkiGoals??0} onChange={e=>setForm({...form,cherkiGoals:Number(e.target.value)})}/></label><label>Asysty<input type="number" min="0" value={form.cherkiAssists??0} onChange={e=>setForm({...form,cherkiAssists:Number(e.target.value)})}/></label></div><div className="editorGroup"><strong>Bryan Mbeumo</strong><label>Gole<input type="number" min="0" value={form.mbeumoGoals??0} onChange={e=>setForm({...form,mbeumoGoals:Number(e.target.value)})}/></label><label>Asysty<input type="number" min="0" value={form.mbeumoAssists??0} onChange={e=>setForm({...form,mbeumoAssists:Number(e.target.value)})}/></label></div></>)}

      {type === "cherki-minutes" && (
        <div className="editorGroup">
          <label className="wide">Minuty Rayan Cherki
            <input type="number" min="0" step="1" value={form.minutes ?? 0} onChange={e => setForm({ ...form, minutes: e.target.value })} />
          </label>
        </div>
      )}

      {type === "resovia" && (
        <div className="editorGroup">
          <label className="wide">
            Status
            <select value={form.status ?? "Trwa"} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Trwa</option>
              <option>Aktualnie awansuje</option>
              <option>Aktualnie nie awansuje</option>
              <option>TAK — awansowała</option>
              <option>NIE — nie awansowała</option>
              <option>Anulowany</option>
            </select>
          </label>
          <label className="wide">Uwagi<input type="text" value={form.note ?? ""} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
        </div>
      )}

      <div className="editorActions">
        <button type="button" className="saveBtn" disabled={saving} onClick={save}>{saving ? "Zapisuję…" : "Zapisz"}</button>
        <button type="button" className="cancelBtn" onClick={() => setEditing(false)}>Anuluj</button>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}

function pickOwners(b) {
  const people = String(b?.people || "").split(" i ").map(x => x.trim()).filter(Boolean);
  const pick = String(b?.pick || "");
  const segments = pick.split("•").map(x => x.trim()).filter(Boolean);

  const owners = segments.map(segment => {
    const colon = segment.indexOf(":");
    return colon >= 0 ? segment.slice(0, colon).trim() : "";
  }).filter(Boolean);

  // Normalnie TYPY są zapisane w kolejności: Nick1: typ • Nick2: typ.
  // Jeśli parser nie znajdzie obu nicków, kolejność people jest bezpiecznym fallbackiem.
  return {
    first: owners[0] || people[0] || null,
    second: owners[1] || people[1] || null
  };
}

function leaderDisplayName(b) {
  if (!b?.leader || b.leader === "Remis") return b?.leader;
  if (b.leader !== "Pierwszy typ" && b.leader !== "Drugi typ") return b.leader;
  const owners = pickOwners(b);
  return b.leader === "Pierwszy typ" ? (owners.first || b.leader) : (owners.second || b.leader);
}

export function BetsTab() {
  const [data, setData] = useState(null);
  const [manual, setManual] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Wszystkie");

  async function loadLive() {
    setLoading(true);
    setError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`/api/live?t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" }
      });

      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.hint || json.error || "Błąd API");
      setData(json);
    } catch (e) {
      setError(
        e?.name === "AbortError"
          ? "Pobieranie danych trwało zbyt długo. Spróbuj odświeżyć stronę."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadManual() {
    try {
      const payload = await sharedManualRequest();
      const map = payload.manual || {};
      setManual(map);
      writeManualStorage(map);
    } catch (error) {
      console.error("shared manual state:", error);
      setManual(readManualStorage());
    }
  }

  useEffect(() => {
    loadLive();
    loadManual();
  }, []);

  const rows = (data?.results ?? bets.map(b => ({
    ...b,
    amount: money(b.amount),
    status: "Trwa",
    liveText: b.mode === "manual" ? "Ręczne rozliczenie" : "Czeka na API",
    leader: null
  }))).map(b => {
    const saved = manual[b.id] || {};
    if (b.mode !== "manual") return { ...b, settled: Boolean(saved.settled), cancelled: Boolean(saved.cancelled) };
    return {
      ...b,
      settled: Boolean(saved.settled),
      cancelled: Boolean(saved.cancelled),
      liveText: manualText(b.manualType, saved),
      leader: manualLeader(b.manualType, saved)
    };
  });

  const people = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      r.people.split(" i ").forEach(p => {
        const name = p.trim();
        map[name] = (map[name] || 0) + 1;
      });
    });
    return Object.entries(map).sort((a,b) => b[1] - a[1]);
  }, [rows]);

  const visible = filter === "Wszystkie"
    ? rows
    : rows.filter(r => r.people.toLowerCase().includes(filter.toLowerCase()));

  const debts = useMemo(() => {
    const pairMap = {};

    

    rows.forEach(b => {
      if (b.settled || b.cancelled) return;
      if (!b.leader || b.leader === "Remis") return;

      const names = b.people.split(" i ").map(x => x.trim());
      if (names.length !== 2) return;

      let winner = names.find(
        n => n.toLowerCase() === String(b.leader).toLowerCase()
      );

      if (!winner && (b.leader === "Pierwszy typ" || b.leader === "Drugi typ")) {
        const owners = pickOwners(b);
        const owner = b.leader === "Pierwszy typ" ? owners.first : owners.second;
        winner = names.find(n => n.toLowerCase() === String(owner || "").toLowerCase());
      }

      if (!winner) return;

      const loser = names.find(n => n.toLowerCase() !== winner.toLowerCase());
      if (!loser) return;

      const amount =
        Number(String(b.amount).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;

      const key = `${loser.toLowerCase()}__${winner.toLowerCase()}`;

      if (!pairMap[key]) {
        pairMap[key] = { loser, winner, amount: 0 };
      }

      pairMap[key].amount += amount;
    });

    // Bilansujemy wzajemne długi dla każdej pary. Jeśli A wisi B 100 zł,
    // a B wisi A 50 zł, pokazujemy tylko: A wisi B 50 zł.
    const netByPair = {};

    Object.values(pairMap).forEach(({ loser, winner, amount }) => {
      const a = loser.toLowerCase();
      const b = winner.toLowerCase();
      const pairKey = [a, b].sort().join("__");

      if (!netByPair[pairKey]) {
        const [first, second] = [loser, winner].sort((x, y) =>
          x.toLowerCase().localeCompare(y.toLowerCase())
        );
        netByPair[pairKey] = { first, second, balance: 0 };
      }

      const pair = netByPair[pairKey];
      if (loser.toLowerCase() === pair.first.toLowerCase()) {
        pair.balance += amount;
      } else {
        pair.balance -= amount;
      }
    });

    return Object.values(netByPair)
      .filter(x => Math.abs(x.balance) > 0.001)
      .map(x => x.balance > 0
        ? { loser: x.first, winner: x.second, amount: x.balance }
        : { loser: x.second, winner: x.first, amount: Math.abs(x.balance) }
      )
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);

  return (
    <>
      <div className="sideHero sideHeroPep" aria-hidden="true" />
      <div className="sideHero sideHeroCherki" aria-hidden="true" />
      <main className="shell">
      
      <a className="fplFeature" href="/fpl">
        <div><span>📰 NOWA ZAKŁADKA</span><strong>FPLowa — Podsumowanie kolejki</strong><small>Wyniki ligi, wtopy, kapitanowie i brukowiec FPL</small></div>
        <b>OTWÓRZ →</b>
      </a>
      <section className="hero">
        <div>
          <p className="eyebrow">SEZON 2026/27</p>
          <h1>Zakłady</h1>
          <p className="sub">Aktualne wyniki, tabela i kanadyjka w jednym miejscu.</p>
        </div>
        <button className="refresh" onClick={() => { loadLive(); loadManual(); }} disabled={loading}>
          {loading ? "Odświeżam…" : "Odśwież"}
        </button>
      </section>

      {error && (
        <div className="warning">
          <strong>Nie udało się pobrać danych live.</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="stats">
        <div className="stat"><span>Zakłady</span><strong>{rows.length}</strong></div>
        <div className="stat"><span>Łączna stawka</span><strong>{bets.reduce((s,b)=>s+b.amount,0)} zł</strong></div>
        <div className="stat"><span>Auto</span><strong>{bets.filter(b=>b.mode!=="manual").length}</strong></div>
        <div className="stat"><span>Ręczne</span><strong>{bets.filter(b=>b.mode==="manual").length}</strong></div>
      </section>

      <section className="filters">
        <button className={filter==="Wszystkie" ? "active" : ""} onClick={()=>setFilter("Wszystkie")}>Wszystkie</button>
        {people.map(([p]) => (
          <button key={p} className={filter===p ? "active" : ""} onClick={()=>setFilter(p)}>{p}</button>
        ))}
      </section>

      <section className="grid">
        {visible.map(b => (
          <article className="bet" key={b.id}>
            <div className="betHeader">
              <div>
                <span className="betLabel">ZAKŁAD #{b.id}</span>
                <div className="people">{b.people}</div>
              </div>
              <div className="betHeaderRight">
                <span className={b.mode === "manual" ? "modeBadge manualMode" : "modeBadge autoMode"}>
                  {b.mode === "manual" ? "Ręczny" : "Auto"}
                </span>
                {b.cancelled && <span className="cancelledBadge">ANULOWANY</span>}
                {b.settled && !b.cancelled && <span className="settledBadge">ROZLICZONY</span>}
                <span className="amount">{b.amount}</span>
              </div>
            </div>

            <div className="betQuestion">
              <span className="sectionLabel">O CO GRAMY</span>
              <h2>{b.title}</h2>
            </div>

            {b.pick && (
              <div className="pickBox">
                <span className="sectionLabel">TYPY</span>
                <p className="pick">{b.pick}</p>
              </div>
            )}

            <div className="liveBox">
              <div className="liveTop">
                <span className="sectionLabel">AKTUALNY STAN</span>
                {b.leader && b.leader !== "Remis" && (
                  <span className="leaderBadge">Prowadzi: {leaderDisplayName(b)}</span>
                )}
                {b.leader === "Remis" && (
                  <span className="leaderBadge neutral">Remis</span>
                )}
              </div>
              <strong className="liveValue">{b.liveText}</strong>
            </div>

            {b.note && (
              <div className="noteBox">
                <span className="sectionLabel">UWAGA</span>
                <p className="note">{b.note}</p>
              </div>
            )}

            <BetFlagsControl
              betId={b.id}
              value={manual[b.id]}
              onSaved={(id, value) => setManual(prev => ({ ...prev, [id]: value }))}
            />

            {b.mode === "manual" && b.manualType && (
              <ManualEditor
                betId={b.id}
                type={b.manualType}
                value={manual[b.id]}
                onSaved={(id, value) => setManual(prev => ({ ...prev, [id]: value }))}
              />
            )}
          </article>
        ))}
      </section>

      <section className="tableWrap">
        <h2>Kto komu wisi — bilans na ten moment</h2>
        <p className="note">
          Liczone według tego, kto aktualnie prowadzi w każdym zakładzie.
          Remisy i zakłady bez ustalonego lidera nie są doliczane.
        </p>

        <div className="debtList">
          {debts.map(d => (
            <div className="debtRow" key={`${d.loser}-${d.winner}`}>
              <div>
                <strong>{d.loser}</strong>
                <span> wisi </span>
                <strong>{d.winner}</strong>
              </div>
              <strong className="debtAmount">{d.amount.toFixed(0)} zł</strong>
            </div>
          ))}

          {debts.length === 0 && (
            <div className="debtEmpty">Na razie nikt nikomu nic nie wisi.</div>
          )}
        </div>
      </section>

      {data?.standings?.length > 0 && (
        <section className="tableWrap">
          <h2>Premier League</h2>
          <div className="table">
            {data.standings.map(s => (
              <div className="tr" key={s.team}>
                <span className="rank">{s.rank}</span>
                <strong>{s.team}</strong>
                <span>{s.played} M</span>
                <span>{s.gd > 0 ? "+" : ""}{s.gd}</span>
                <strong>{s.points} pkt</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer>
        {data?.updatedAt
          ? `Ostatnie pobranie danych: ${new Date(data.updatedAt).toLocaleString("pl-PL")}`
          : "Po podłączeniu API dane sportowe będą aktualizowane automatycznie."}
      </footer>
    </main>
    </>
  );
}
