"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function pressQuote(p, gw){
 const seed=(p.entry*1543 + gw*257 + p.team.length*71 + Math.round(p.editorial*10)*29)>>>0;
 const pick=(arr,s=0)=>arr[(seed+s*101)%arr.length];

 const openings=[
  "Powiem wprost: nie jestem zadowolony, ale też nie będę robił z tego końca świata.",
  "Wynik jest jaki jest. Jak ktoś chce mnie za to ukrzyżować, to niech przynajmniej sprawdzi ławkę.",
  "Nie zamierzam przepraszać za odważne decyzje. Za głupie może kiedyś.",
  "To była kolejka, po której człowiek ma ochotę wyłączyć telefon i udawać, że FPL nie istnieje.",
  "Nie wszystko zagrało, ale nie będę pierdolił, że jestem zaskoczony.",
  "Wiedzieliśmy, że ten weekend może boleć. Nie wiedzieliśmy, że aż tak.",
  "Nie ma kryzysu. Jest tylko seria wydarzeń, które wyglądają dokładnie jak kryzys.",
  "Jeżeli ktoś oczekuje ode mnie paniki, to musi poczekać do kolejnego deadline'u.",
  "Nie będę szukał wymówek. Chociaż mam ich kilka całkiem dobrych.",
  "Zespół dał mi dokładnie tyle radości, ile zwykle daje aktualizacja czerwonej strzałki."
 ];

 const statBits=[];
 if(p.rank===1) statBits.push(
   `Jesteśmy liderem. To reszta ma problem, nie ja. Jak spadnę, wtedy możecie się śmiać.`,
   `Tabela mówi, że jestem pierwszy, więc wszystkie moje idiotyczne decyzje chwilowo są „odważnymi decyzjami”.`,
   `Pierwsze miejsce daje mi luksus mówienia głupot z pełnym przekonaniem.`
 );
 if(p.rank>5) statBits.push(
   `Miejsce ${p.rank}. nie wygląda dobrze, ale przynajmniej nie muszę udawać, że jest idealnie.`,
   `Jestem ${p.rank}. i nie, nie planowałem tego jako strategii długoterminowej.`,
   `Ranking #${p.rank} to konkretna informacja zwrotna od rzeczywistości: „ogarnij się”.`
 );
 if(p.benchSeason>=40) statBits.push(
   `Tak, wiem, że na ławce mam już ${p.benchSeason} punktów. Rezerwowi prawdopodobnie mają własny czat beze mnie.`,
   `${p.benchSeason} punktów na ławce to dużo. Nie trzeba mi tego, kurwa, przypominać co konferencję.`,
   `Ławka ma ${p.benchSeason}. Jeśli ktoś chce objąć funkcję trenera rezerw, proszę wysłać CV.`
 );
 if(p.hitSeason>=8) statBits.push(
   `Hity kosztowały ${p.hitSeason} punktów. Czasem trzeba zapłacić za wizję. Czasem wizja jest chujowa.`,
   `Wydałem ${p.hitSeason} punktów na transfery. Nie wszystkie ruchy były złe. Niektóre były tylko kompletnie bezsensowne.`,
   `Koszt hitów to ${p.hitSeason}. Dział finansowy nie jest zachwycony, ja też nie.`
 );
 if(p.avg3>=60) statBits.push(
   `Forma ${p.avg3} z ostatnich trzech GW jest dobra, więc spokojnie — nie zamierzam teraz rozpierdolić pół składu.`,
   `Średnia ${p.avg3} z trzech kolejek pokazuje, że coś robimy dobrze. Nie pytajcie co dokładnie.`,
   `Ostatnie trzy GW są mocne. Tak, będę się tym chwalił, bo za tydzień może już nie być czym.`
 );
 if(p.avg3>0&&p.avg3<=35) statBits.push(
   `Średnia ${p.avg3} z trzech GW jest gówniana. Nie będę udawał, że to „proces”.`,
   `Forma ${p.avg3} wygląda jak sygnał alarmowy. Jeszcze nie uciekam, ale buty mam już założone.`,
   `Ostatnie trzy kolejki są tak słabe, że nawet ja nie mam siły ich bronić.`
 );

 const statLine = statBits.length ? pick(statBits,2) : pick([
   `Aktualnie mam ${p.editorial}/10 od redakcji i traktuję to dokładnie tak poważnie, jak na to zasługuje.`,
   `Tabela i liczby są jakie są. Można je analizować albo przeklinać — robię jedno i drugie.`,
   `Nie będę rozkładał każdej decyzji na czynniki pierwsze, bo część z nich nie przeżyłaby analizy.`,
   `Sytuacja nie jest idealna, ale przynajmniej materiał do FPLowej się zgadza.`
 ],3);

 const tactical=[
  "Kapitan? Decyzję podjąłem świadomie. To, że wyszła jak gówno, nie zmienia procesu.",
  "Ławka była ustawiona zgodnie z informacjami przed deadline'em. Informacje najwyraźniej miały mnie w dupie.",
  "Nie zamierzam robić transferów tylko dlatego, że Twitter krzyczy. Czasem zrobię je dlatego, że sam panikuję.",
  "Mamy plan na kolejne GW. Nie mogę go zdradzić, bo jeszcze ktoś by zauważył, że jest dziwny.",
  "Nie będę kopiował template'u. Chyba że template znowu zacznie punktować.",
  "Najważniejsze, żeby nie odjebać czegoś pięć minut przed deadline'em. To jest główny cel tygodnia.",
  "Zespół potrzebuje stabilności. Ja potrzebuję, żeby zawodnicy wreszcie zaczęli robić to, za co ich kupiłem.",
  "Nie będę komentował plotek transferowych. Sam jeszcze nie wiem, kogo jutro wypierdolę.",
  "Na razie żadnych gwałtownych ruchów. Mówię to teraz, przed otwarciem aplikacji.",
  "Musimy zachować zimną głowę. Szczególnie ja, bo to zwykle ja robię największy burdel."
 ];

 const closer=[
  "Następne pytanie, zanim powiem coś, czego będę żałował.",
  "Do zobaczenia po deadline'ie. Albo w Prokuraturze FPL.",
  "Pracujemy dalej, bo niestety przycisku „cofnij kolejkę” nadal nie dodali.",
  "Resztę pokaże tabela. Oby nie za brutalnie.",
  "Na dziś wystarczy. Idę patrzeć na price changes i podejmować kolejne wątpliwe decyzje.",
  "Konferencja zakończona. Telefon wyciszam, Twittera nie otwieram.",
  "Wrócimy silniejsi. A jak nie, to przynajmniej z nowym wymówkami.",
  "Kibice mają prawo być wkurwieni. Ja też jestem, tylko na siebie.",
  "Nie mam nic więcej do dodania, poza kilkoma przekleństwami, których nie będę cytował.",
  "Deadline wszystko zweryfikuje. Jak zwykle brutalnie."
 ];

 return `„${pick(openings,1)} ${statLine} ${pick(tactical,4)} ${pick(closer,5)}”`;
}

function pressReaction(p, gw){
 const seed=(p.entry*809+gw*313+p.manager.length*47+p.team.length*23)>>>0;
 const a=[
  `${p.manager} brzmi, jakby sam sobie wierzył w około 62%.`,
  `To klasyczne pomeczowe pierdolenie, ale trzeba przyznać — przynajmniej z charakterem.`,
  `Piękne słowa. Punkty nadal nie czytają konferencji prasowych.`,
  `Dział PR ${p.team} właśnie zrobił więcej dobrego niż część składu.`,
  `Brzmi rozsądnie, dopóki człowiek nie otworzy historii transferów.`,
  `Zarząd popiera menedżera. Redakcja już szykuje nekrolog projektu.`,
  `Wypowiedź mocna. Dowody na boisku trochę słabsze.`,
  `Jeśli za konferencje byłyby bonus points, byłby haul.`,
  `Narracja się zgadza. Teraz tylko rzeczywistość musi przestać przeszkadzać.`,
  `Kibice ${p.team} proszą o mniej storytellingu, więcej zielonych strzałek.`
 ];
 const b=[
  `Najbardziej wiarygodny fragment to ten, w którym przyznał, że jest wkurwiony.`,
  `Reszta ligi oczywiście życzy mu wszystkiego najgorszego sportowo.`,
  `Redakcja zachowuje pełne prawo do wyciągnięcia tego cytatu po następnej katastrofie.`,
  `Cytat trafia do archiwum i może zostać użyty przeciwko niemu bez ostrzeżenia.`,
  `Następny deadline pokaże, czy to była refleksja, czy tylko ładnie opakowane gówno.`,
  `Na razie nie wydajemy wyroku. Prokurator jest jednak w budynku.`,
  `Wizerunkowo 8/10. Punktowo sprawdzimy po weekendzie.`,
  `Menedżer zachował spokój. To zwykle najgorszy moment na kolejną odważną decyzję.`,
  `Nie kupujemy wszystkiego, ale przynajmniej było śmiesznie.`,
  `Prasa dziękuje za materiał i czeka na następną katastrofę.`
 ];
 return `${a[seed%a.length]} ${b[(seed*7+3)%b.length]}`;
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
 return <>
   <div className="sideHero sideHeroPep" aria-hidden="true" />
   <div className="sideHero sideHeroCherki" aria-hidden="true" />
   <main className="shell fplPage">
   <nav className="topNav"><Link href="/fpl">📰 Kolejnik</Link><strong>FPLowa</strong><button onClick={load}>Odśwież</button></nav>
   <section className="newspaperHero"><div><span className="paperKicker">FPLowa • GW {data?.gw??"—"} {data?(data.gwFinished?"• WYDANIE KOŃCOWE":"• LIVE"):""}</span><h1>📰 FPLOWA</h1><p>Brukowiec, centrum dowodzenia i kronika kompromitacji Waszej ligi.</p>{data?.updatedAt&&<small className="fplUpdated">Aktualizacja: {new Date(data.updatedAt).toLocaleString("pl-PL")}</small>}</div></section>
   <div className="fplTabs">
     <a className="kolejnikExternalTab" href="/zaklady">🎲 Zakłady</a>
     {[["gazeta","📰 Gazeta"],["live","⚡ Live"],["profile","👤 Profile"],["historia","🏛️ Hall of Shame"],["rywalizacja","🥊 Rivalry"],["gala","🏆 Awards"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}
   </div>
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
 </>
}
function Card({title,children}){return <section className="megaCard"><h2>{title}</h2>{children}</section>}
function Standings({data,onProfile}){return <section className="fplStandings"><div className="sectionHead"><div><span className="sectionLabel">LIGA 286732</span><h2>{data.league.name}</h2></div><span>GW {data.gw}</span></div><div className="fplTable"><div className="fplTr fplTh"><span>#</span><span>Drużyna</span><span>GW</span><span>Suma</span><span>Zmiana</span></div>{data.standings.map(x=><button className="fplTr fplRowBtn" key={x.entry} onClick={()=>onProfile(x.entry)}><strong>{x.rank}</strong><div><strong>{x.team}</strong><small>{x.manager}</small></div><strong>{x.gwPoints}</strong><span>{x.overall}</span><span>{x.lastRank>x.rank?`▲ ${x.lastRank-x.rank}`:x.lastRank<x.rank?`▼ ${x.rank-x.lastRank}`:"—"}</span></button>)}</div></section>}
function Profile({p,close}){return <div className="profileModal"><button onClick={close}>✕</button><span className="newsTag">{p.icon} {p.label}</span><h2>{p.manager} — {p.team}</h2><div className="profileStats"><b>Overall #{p.rank}</b><b>Forma {p.form}</b><b>Ocena {p.editorial}/10</b><b>Średnia {p.avg}</b><b>3 GW {p.avg3}</b><b>Ławka {p.benchSeason}</b><b>Hity -{p.hitSeason}</b></div>{p.bestGW&&<p>Najlepsza GW: <b>{p.bestGW.points} pkt (GW{p.bestGW.gw})</b></p>}{p.worstGW&&<p>Najgorsza GW: <b>{p.worstGW.points} pkt (GW{p.worstGW.gw})</b></p>}<div className="profileComment"><b>Opinia redakcji:</b><p>{p.comment}</p></div></div>}
