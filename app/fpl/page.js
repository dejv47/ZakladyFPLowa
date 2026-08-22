"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function FPLPage(){
 const [data,setData]=useState(null),[error,setError]=useState("");
 async function load(){
   setError("");
   try{
     const r=await fetch(`/api/fpl?t=${Date.now()}`,{cache:"no-store"});
     const j=await r.json();
     if(!j.ok) throw new Error(j.error||"Błąd FPL");
     setData(j);
   }catch(e){setError(e.message)}
 }
 useEffect(()=>{load()},[]);
 return <main className="shell fplPage">
   <nav className="topNav"><Link href="/">← Zakłady</Link><strong>FPLowa</strong><button onClick={load}>Odśwież</button></nav>
   <section className="newspaperHero">
     <div><span className="paperKicker">FPLowa • wydanie GW {data?.gw ?? "—"}</span>
     <h1>📰 PODSUMOWANIE KOLEJKI</h1>
     <p>Najważniejsze wydarzenia, katastrofy kadrowe i decyzje wymagające komisji śledczej.</p></div>
   </section>
   {error&&<div className="error">{error}</div>}
   {!data&&!error&&<div className="loading">Redakcja zbiera materiały...</div>}
   {data&&<>
    <section className="articles">
      {data.articles.map((a,i)=><article className={`newsCard ${i===0?"leadStory":""}`} key={i}>
        <span className="newsTag">{a.tag}</span><h2>{a.title}</h2><p>{a.body}</p>
      </article>)}
    </section>
    <section className="fplStandings">
      <div className="sectionHead"><div><span className="sectionLabel">LIGA 286732</span><h2>{data.league.name}</h2></div><span>GW {data.gw}</span></div>
      <div className="fplTable">
        <div className="fplTr fplTh"><span>#</span><span>Drużyna</span><span>GW</span><span>Suma</span><span>Zmiana</span></div>
        {data.standings.map(x=><div className="fplTr" key={x.entry}>
          <strong>{x.rank}</strong><div><strong>{x.team}</strong><small>{x.manager}</small></div>
          <strong>{x.gwPoints}</strong><span>{x.total}</span>
          <span>{x.lastRank>x.rank?`▲ ${x.lastRank-x.rank}`:x.lastRank<x.rank?`▼ ${x.rank-x.lastRank}`:"—"}</span>
        </div>)}
      </div>
    </section>
   </>}
 </main>
}
