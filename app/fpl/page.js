"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function pressQuote(p, gw){
 const seed = (p.entry*97 + gw*31 + p.team.length*11) >>> 0;
 const pick=(arr,s=0)=>arr[(seed+s*13)%arr.length];

 const starts = p.editorial>=7 ? [
  "Nie zamierzam przepraszać za dobre decyzje.",
  "Wynik mówi sam za siebie, ja nie muszę.",
  "Plan był jasny od początku.",
  "Nie interesuje mnie, co pisze prasa.",
  "Mamy swoje liczby i im ufamy.",
  "Wiedzieliśmy, gdzie są przewagi.",
  "Nie było tu żadnego przypadku.",
  "Zespół odpowiedział na boisku."
 ] : p.editorial>=5 ? [
  "Było kilka dobrych decyzji i kilka, o których nie chcę rozmawiać.",
  "Nie wszystko zagrało tak, jak planowaliśmy.",
  "Musimy zachować spokój.",
  "Sezon jest długi, a Twitter krótko pamięta.",
  "Nie będę oceniał wszystkiego po jednej kolejce.",
  "Są elementy do poprawy, ale nie ma paniki.",
  "Widzimy progres, nawet jeśli tabela czasem go nie widzi.",
  "Nie podejmowaliśmy decyzji pod wpływem emocji. Chyba."
 ] : [
  "Nie będę komentował decyzji personalnych.",
  "Musimy wyciągnąć wnioski.",
  "To była trudna kolejka.",
  "Biorę odpowiedzialność, ale nie całą.",
  "Nie wszystko da się przewidzieć.",
  "Zawodnicy dali z siebie tyle, ile mogli. Problem w tym, że niewiele.",
  "Nie będę odpowiadał na pytania o przyszłość.",
  "Potrzebujemy reakcji w następnej kolejce."
 ];

 const middles = p.benchSeason>=35 ? [
  `Ławka? Tak, widziałem te ${p.benchSeason} punktów. Następne pytanie.`,
  `Nie uważam, że ${p.benchSeason} punktów na ławce to problem systemowy.`,
  "Dobór ławki był świadomy. Wynik niestety też.",
  "Nie będę robił zmian tylko dlatego, że rezerwowi wyglądają lepiej."
 ] : p.hitSeason>=8 ? [
  `Transfery kosztowały nas ${p.hitSeason} punktów, ale projekt wymaga odwagi.`,
  "Hity były częścią planu. Plan być może wymaga korekty.",
  "Nie boimy się minusowych punktów, bo najwyraźniej powinniśmy.",
  "Rynek transferowy jest trudny. Szczególnie dla nas."
 ] : [
  "Skupiamy się na procesie, nie na memach.",
  "Najważniejsza jest reakcja zespołu.",
  "Nie będziemy zmieniać wszystkiego po jednym weekendzie.",
  "Zaufanie do projektu pozostaje pełne."
 ];

 const ends = [
  "Do zobaczenia po następnym deadline'ie.",
  "Teraz najważniejsze, żeby nie odjebać czegoś jeszcze głupszego.",
  "Pracujemy dalej.",
  "Nie czytam komentarzy. Podobno.",
  "Następne pytanie.",
  "Konferencja zakończona.",
  "Resztę pokaże tabela.",
  "Wrócimy silniejsi albo przynajmniej z nowym kapitanem."
 ];

 return `„${pick(starts,1)} ${pick(middles,2)} ${pick(ends,3)}”`;
}

function pressReaction(p, gw){
 const seed=(p.entry*53+gw*19+p.manager.length*7)>>>0;
 const lines=[
  `${p.manager} brzmi jak człowiek, który sam sobie nie wierzy.`,
  `Redakcja zanotowała wypowiedź i odłożyła ją do teczki „klasyczne pierdolenie pomeczowe”.`,
  `Piękne słowa. Szkoda, że punkty nie czytają konferencji.`,
  `PR działa lepiej niż część decyzji kadrowych.`,
  `Brzmi profesjonalnie, dopóki człowiek nie spojrzy na liczby.`,
  `Zarząd popiera trenera. Wiemy, co to zwykle znaczy.`,
  `Redakcja pozostaje sceptyczna i lekko rozbawiona.`,
  `Wszystko brzmi świetnie. Teraz poprosimy jeszcze o dobry wynik.`,
  `To była konferencja z gatunku „dużo słów, mało punktów”.`,
  `Kibice proszą o mniej narracji, więcej punktów.`,
  `Dział komunikacji uratował więcej niż kapitan w tej kolejce.`,
  `Po tej wypowiedzi sytuacja nie jest jaśniejsza, ale przynajmniej jest śmieszniej.`
 ];
 return lines[seed%lines.length];
}

export default function FPLPage(){
 const [data,setData]=useState(null),[error,setError]=useState(""),[tab,setTab]=useState("gazeta"),[profile,setProfile]=useState(null);
 async function load(){
   setError("");
   try{
     const r=await fetch(`/api/fpl?t=${Date.now()}`,{cache:"no-store"});
     const j=await r.json();
     if(!j.ok) throw new Error(j.error||"Błąd FPL");
     setData(j);
   }catch(e){setError(e.message)}
 }
 useEffect(()=>{load(); const i=setInterval(load,5*60*1000); const v=()=>document.visibilityState==="visible"&&load(); document.addEventListener("visibilitychange",v); return()=>{clearInterval(i);document.removeEventListener("visibilitychange",v)}},[]);
 const profileData=useMemo(()=>data?.grades?.find(x=>x.entry===profile),[data,profile]);
 return <main className="shell fplPage">
   <nav className="topNav"><Link href="/">← Zakłady</Link><strong>FPLowa</strong><button onClick={load}>Odśwież</button></nav>
   <section className="newspaperHero"><div><span className="paperKicker">FPLowa • GW {data?.gw??"—"} {data?(data.gwFinished?"• WYDANIE KOŃCOWE":"• LIVE"):""}</span><h1>📰 FPLOWA</h1><p>Brukowiec, centrum dowodzenia i kronika kompromitacji Waszej ligi.</p>{data?.updatedAt&&<small className="fplUpdated">Aktualizacja: {new Date(data.updatedAt).toLocaleString("pl-PL")}</small>}</div></section>
   <div className="fplTabs">{[["gazeta","📰 Gazeta"],["live","⚡ Live"],["profile","👤 Profile"],["historia","🏛️ Hall of Shame"],["rywalizacja","🥊 Rivalry"],["gala","🏆 Awards"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}</div>
   {error&&<div className="error">{error}</div>}{!data&&!error&&<div className="loading">Redakcja zbiera materiały...</div>}
   {data&&tab==="gazeta"&&<>
     <section className="awardStrip">{data.awards?.map((a,i)=><div className="awardMini" key={i}><b>{a.icon} {a.name}</b><strong>{a.manager}</strong><small>{a.value}</small></div>)}</section>
     {data.breakingNews?.length>0&&<section className="breaking"><b>🔴 BREAKING NEWS</b><div className="ticker">{data.breakingNews.join(" • ")}</div></section>}
     <section className="articles">{data.articles.map((a,i)=><article className={`newsCard ${i===0?"leadStory":""}`} key={i}><span className="newsTag">{a.tag}</span><h2>{a.title}</h2><p>{a.body}</p></article>)}</section>
     <Standings data={data} onProfile={setProfile}/>
   </>}
   {data&&tab==="live"&&<section className="megaGrid">
     <Card title="⚽ Kogo oglądamy?">{data.watchList.map(x=><p key={x.manager}><b>{x.manager}:</b> {x.active.length?`grają: ${x.active.join(", ")}`:""} {x.remaining.length?` • czekają: ${x.remaining.join(", ")}`:" • wszyscy już zaczęli"}</p>)}</Card>
     {data.deathMatch&&<Card title="💀 Death Match"><h3>{data.deathMatch.a.manager} {data.deathMatch.a.points} : {data.deathMatch.b.points} {data.deathMatch.b.manager}</h3><p><b>{data.deathMatch.a.manager} różnice:</b> {data.deathMatch.a.unique.join(", ")||"brak"}</p><p><b>{data.deathMatch.b.manager} różnice:</b> {data.deathMatch.b.unique.join(", ")||"brak"}</p></Card>}
     <Card title="🎰 Szanse na wygranie GW"><small>Orientacyjna zabawa na podstawie aktualnych punktów i liczby nierozpoczętych zawodników — nie model bukmacherski.</small>{data.gwChances.map(x=><div className="chance" key={x.manager}><span>{x.manager} • {x.points} pkt • zostało {x.remaining}</span><b>{x.chance}%</b></div>)}</Card>
     <Card title="🧮 Co musi się stać?">{data.deathMatch?<p>{data.deathMatch.a.manager} i {data.deathMatch.b.manager} dzieli tylko <b>{data.deathMatch.gap} pkt</b>. Największe znaczenie będą miały różnice składów pokazane wyżej.</p>:<p>Brak bliskiej walki.</p>}</Card>
     <Card title="🔮 Typy redakcji"><p><b>{data.predictions.label}</b></p><p>Typ na mocny wynik: <b>{data.predictions.winner?.manager}</b> ({data.predictions.winner?.avg3} średnio z ostatnich 3 GW).</p><p>Kandydat do wpierdolu: <b>{data.predictions.danger?.manager}</b> ({data.predictions.danger?.avg3}).</p></Card>
     <Card title="💰 Wirtualne kursy na mistrza"><small>Tylko zabawowa symulacja, bez prawdziwych zakładów.</small>{data.virtualOdds.map(x=><div className="chance" key={x.manager}><span>{x.manager} • {x.prob}%</span><b>{x.odds}</b></div>)}</Card>
   </section>}
   {data&&tab==="profile"&&<><section className="profileGrid">{data.grades.map(x=><button className="profileCard" key={x.entry} onClick={()=>setProfile(x.entry)}><div className="profileIcon">{x.icon}</div><span>{x.label}</span><h3>{x.manager}</h3><p>{x.team}</p><b>{x.editorial}/10</b><small>{x.form}</small></button>)}</section>{profileData&&<Profile p={profileData} close={()=>setProfile(null)}/>}</>}
   {data&&tab==="historia"&&<section className="megaGrid">
     <Card title="🏅 Hall of Shame">
       {data.hallOfShame.length
         ? data.hallOfShame.map((x,i)=><div className="record shameRecord" key={i}><b>{x.kind}</b><strong>{x.manager} — {x.value}</strong><small>{x.team}</small></div>)
         : <p>Jeszcze za mało zakończonych kolejek, żeby uczciwie kogoś publicznie upokorzyć.</p>}
     </Card>
     <Card title="📊 Power Ranking — forma 3 GW">
       {[...data.managerProfiles].sort((a,b)=>b.avg3-a.avg3).map((x,i)=><div className="chance" key={x.entry}><span>#{i+1} {x.icon} {x.manager} • {x.form}</span><b>{x.avg3}</b></div>)}
     </Card>
   </section>}
   {data&&tab==="rywalizacja"&&<section className="megaGrid">
     <Card title="🥊 Rywalizacje head-to-head">
       <div className="rivalryCards">
         {data.rivalryProfiles.map(x=><details className="rivalryCard" key={x.entry}>
           <summary>
             <div><span>⚔️</span><div><b>{x.manager}</b><small>{x.team}</small></div></div>
             <strong>rozwiń</strong>
           </summary>
           <div className="rivalryBody">
             {x.matches.map((m,i)=><div className="rivalryLine" key={i}>
               <span>vs <b>{m.opponent}</b></span>
               <strong className={m.wins>m.losses?"positive":m.wins<m.losses?"negative":""}>{m.wins}–{m.losses}</strong>
               <small>remisy: {m.draws}</small>
             </div>)}
           </div>
         </details>)}
       </div>
     </Card>
     <Card title="⭐ Oceny redakcji">
       {[...data.grades].sort((a,b)=>b.editorial-a.editorial).map(x=><div className="grade" key={x.entry}><b>{x.icon} {x.manager}: {x.editorial}/10 — {x.label}</b><p>{x.comment}</p></div>)}
     </Card>
   </section>}
   {data&&tab==="gala"&&<section className="megaGrid">
     <Card title={data.gw>=38&&data.gwFinished?"🏁 FPLowa Awards — GALA FINAŁOWA":"🏆 FPLowa Awards — stan na dziś"}>
       <div className="awardGallery">{data.seasonAwards.map((x,i)=><div className="awardBig" key={i}><span>{x.icon}</span><div><b>{x.name}</b><strong>{x.manager}</strong><small>{x.team} • {x.value}</small></div></div>)}</div>
     </Card>
     <Card title="🎙️ Konferencja prasowa">
       {data.grades.map(x=><blockquote key={x.entry}><div className="pressSpeaker"><span>🎙️</span><div><b>{x.manager}</b><small>{x.team}</small></div></div>{pressQuote(x,data.gw)}<small><b>Redakcja:</b> {pressReaction(x,data.gw)}</small></blockquote>)}
     </Card>
   </section>}
 </main>
}
function Card({title,children}){return <section className="megaCard"><h2>{title}</h2>{children}</section>}
function Standings({data,onProfile}){return <section className="fplStandings"><div className="sectionHead"><div><span className="sectionLabel">LIGA 286732</span><h2>{data.league.name}</h2></div><span>GW {data.gw}</span></div><div className="fplTable"><div className="fplTr fplTh"><span>#</span><span>Drużyna</span><span>GW</span><span>Suma</span><span>Zmiana</span></div>{data.standings.map(x=><button className="fplTr fplRowBtn" key={x.entry} onClick={()=>onProfile(x.entry)}><strong>{x.rank}</strong><div><strong>{x.team}</strong><small>{x.manager}</small></div><strong>{x.gwPoints}</strong><span>{x.overall}</span><span>{x.lastRank>x.rank?`▲ ${x.lastRank-x.rank}`:x.lastRank<x.rank?`▼ ${x.rank-x.lastRank}`:"—"}</span></button>)}</div></section>}
function Profile({p,close}){return <div className="profileModal"><button onClick={close}>✕</button><span className="newsTag">{p.icon} {p.label}</span><h2>{p.manager} — {p.team}</h2><div className="profileStats"><b>Overall #{p.rank}</b><b>Forma {p.form}</b><b>Ocena {p.editorial}/10</b><b>Średnia {p.avg}</b><b>3 GW {p.avg3}</b><b>Ławka {p.benchSeason}</b><b>Hity -{p.hitSeason}</b></div>{p.bestGW&&<p>Najlepsza GW: <b>{p.bestGW.points} pkt (GW{p.bestGW.gw})</b></p>}{p.worstGW&&<p>Najgorsza GW: <b>{p.worstGW.points} pkt (GW{p.worstGW.gw})</b></p>}<div className="profileComment"><b>Opinia redakcji:</b><p>{p.comment}</p></div></div>}
