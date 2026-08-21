"use client";

import { useEffect, useMemo, useState } from "react";
import { bets } from "../lib/bets";

function money(n) {
  return `${n.toFixed(2).replace(".", ",")} zł`;
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Wszystkie");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.hint || json.error || "Błąd API");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const rows = data?.results ?? bets.map(b => ({
    ...b,
    amount: money(b.amount),
    status: "Trwa",
    liveText: b.mode === "manual" ? "Ręczne rozliczenie" : "Czeka na API",
    leader: null
  }));

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

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SEZON 2026/27</p>
          <h1>Zakłady</h1>
          <p className="sub">Aktualne wyniki, tabela i kanadyjka w jednym miejscu.</p>
        </div>
        <button className="refresh" onClick={load} disabled={loading}>
          {loading ? "Odświeżam…" : "Odśwież"}
        </button>
      </section>

      {error && (
        <div className="warning">
          <strong>Dane live jeszcze nie są podłączone.</strong>
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
            <div className="betTop">
              <span className="people">{b.people}</span>
              <span className="amount">{b.amount}</span>
            </div>
            <h2>{b.title}</h2>
            {b.pick && <p className="pick">{b.pick}</p>}

            <div className="liveBox">
              <span>AKTUALNIE</span>
              <strong>{b.liveText}</strong>
              {b.leader && <em>Prowadzi: {b.leader}</em>}
            </div>

            {b.note && <p className="note">{b.note}</p>}
            <div className="status">
              <span className={b.mode === "manual" ? "dot manual" : "dot"} />
              {b.mode === "manual" ? "Ręczne" : "Automatyczne"}
            </div>
          </article>
        ))}
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
          : "Po dodaniu klucza API dane sportowe będą aktualizowane automatycznie."}
      </footer>
    </main>
  );
}
