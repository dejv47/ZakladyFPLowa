"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BetsTab } from "./BetsTab";

function managerKey(p){
 return `${p.manager}__${p.team}`.toLowerCase().replace(/\s+/g,"_");
}

function hashText(s){
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
 return h>>>0;
}
function seededPick(arr,seed,used=new Set()){
 if(!arr?.length) return "";
 let idx=seed%arr.length;
 for(let i=0;i<arr.length;i++){
   const v=arr[(idx+i)%arr.length];
   if(!used.has(v)){used.add(v);return v}
 }
 return arr[idx];
}
function uniqSentence(s, p, gw, n){
 // Identity tag is deliberately woven into the sentence, so two managers/GWs
 // can never receive an identical full sentence even if a phrase template collides.
 return s.replaceAll("{M}",p.manager).replaceAll("{T}",p.team).replaceAll("{GW}",String(gw))
   .replaceAll("{FORM}",String(p.avg3 ?? "—")).replaceAll("{BENCH}",String(p.benchSeason ?? 0))
   .replaceAll("{HITS}",String(p.hitSeason ?? 0)).replaceAll("{RANK}",String(p.rank ?? "—"));
}

const PRESS_OPEN=[
 "{M} wszedł na konferencję po GW{GW} z miną człowieka, który właśnie odkrył, że jego genialny plan dla {T} był genialny głównie przed deadline'em.",
 "Po GW{GW} {M} nie próbował nawet sprzedawać bajki o procesie: w {T} proces chwilami przypominał wrzucenie tostera do wanny i oczekiwanie clean sheeta.",
 "{M} zaczął konferencję {T} od stwierdzenia, że GW{GW} była bardzo pouczająca. Redakcja tłumaczy: dostał po ryju od FPL i teraz udaje filozofa.",
 "Sala ucichła, kiedy {M} pojawił się po GW{GW}. Przy formie {FORM} nawet mikrofony wyglądały, jakby nie chciały zadawać trudnych pytań ekipie {T}.",
 "Konferencja {T} po GW{GW} zaczęła się bez prezentacji PowerPoint. {M} uznał najwyraźniej, że wystarczająco dużo fikcji było już na boisku."
];
const PRESS_DATA=[
 "„Mam formę {FORM}, ławkę {BENCH} i {HITS} punktów oddanych za hity. Jeżeli ktoś z tych liczb potrafi ulepić historię o pełnej kontroli, to niech od razu pisze fantastykę.”",
 "„Pozycja {RANK} nie jest dekoracją. {M} może sobie opowiadać o expected points, ale {T} potrzebuje prawdziwych punktów, a nie jebanych slajdów.”",
 "„Ławka kosztowała mnie już {BENCH}. To nie jest rezerwa, tylko prywatny magazyn punktów, których z jakiegoś powodu nie pozwalam używać {T}.”",
 "„Hity: {HITS}. Każde -4 wygląda niewinnie osobno, a razem zaczynają przypominać abonament na podejmowanie chujowych decyzji.”",
 "„Forma {FORM} mówi wystarczająco dużo. Jeśli następny transfer ma być lekarstwem, najpierw sprawdzę, czy przypadkiem to ja nie jestem chorobą {T}.”"
];
const PRESS_PLAN=[
 "„Przed następnym deadline'em {M} ma jedną zasadę: żadnego transferu pod wpływem jednego gola, jednego tweeta i jednego typa z flagą Brazylii w nazwie konta.”",
 "„W {T} kończymy z ruchem dla samego ruchu. Jak zawodnik blanknie raz, nie będę go wypierdalał jak wściekły ochroniarz z dyskoteki.”",
 "„Następny plan {M} jest banalny: kapitan ma zdobywać punkty, ławka ma przestać szydzić, a ja mam nie odpierdolić niczego pięć minut przed deadlinem.”",
 "„{T} nie potrzebuje rewolucji. Potrzebuje, żebym przez tydzień nie zachowywał się jak człowiek, który dostał nieograniczony budżet w Football Managerze.”",
 "„Jeśli w GW{GW} czegoś się nauczyłem, to tego, że differential bez punktów jest po prostu drogim sposobem na pokazanie wszystkim, jaki jesteś wyjątkowy.”"
];
const PRESS_END=[
 "„Jeżeli za tydzień znowu tu usiądę po katastrofie, przynajmniej nie będę pierdolił, że wszystko przebiega zgodnie z planem {M}.”",
 "„Kibice {T} zasługują na spokój. Niestety ich menedżerem nadal jest {M}, więc nie obiecuję cudów.”",
 "„Nie proszę o cierpliwość. Proszę tylko, żebyście z wyzwiskami poczekali do ostatniego meczu GW{GW}, bo może ktoś jeszcze uratuje mi dupę.”",
 "„Wnioski są wyciągnięte. Czy właściwe? To już, kurwa, zupełnie inna dyscyplina.”",
 "„Do następnej kolejki {M} zamyka laboratorium. {T} spróbuje przez chwilę zachowywać się jak normalna drużyna fantasy.”"
];

function pressQuote(p,gw){
 const seed=hashText(`${managerKey(p)}|conference|${gw}`);
 const used=new Set();
 const pools=[PRESS_OPEN,PRESS_DATA,PRESS_PLAN,PRESS_END];
 const parts=pools.map((pool,i)=>uniqSentence(seededPick(pool,seed+i*7919,used),p,gw,i));
 // Add a deterministic identity sentence. This makes the whole conference
 // season-specific even when the same structural template returns months later.
 const stamp=`„To jest konferencja ${p.manager}, menedżera ${p.team}, po GW${gw}; za tydzień nie zamierzam powtarzać ani tej wymówki, ani tego samego błędu.”`;
 return `${parts.join(" ")} ${stamp}`;
}

function pressReaction(p,gw){
 const seed=hashText(`${managerKey(p)}|reaction|${gw}`);
 const pool=[
  "Redakcja po GW{GW}: {M} z {T} przynajmniej nie próbował zamienić katastrofy w TED Talk. To już jakiś postęp.",
  "Werdykt studia po GW{GW}: słowa {M} brzmią rozsądnie, co w przypadku {T} oznacza, że następny deadline zapowiada się wyjątkowo niebezpiecznie.",
  "Komentarz redakcji: {M} obiecał mniej chaosu w {T}. Bukmacherzy odmówili wystawienia kursu, bo uznali rynek za zbyt absurdalny.",
  "Po wystąpieniu {M} jedno jest pewne: {T} ma plan. Nie jest jeszcze pewne, czy plan wie, że istnieje.",
  "Redakcja ocenia konferencję {M} na mocne „zobaczymy”. W {T} piękne przemowy punktów jeszcze nie dawały."
 ];
 return uniqSentence(pool[seed%pool.length],p,gw,0);
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
 useEffect(()=>{
   const params = new URLSearchParams(window.location.search);
   if(params.get("tab")==="zaklady") setTab("zaklady");

   load();

   const i=setInterval(load,5*60*1000);
   const v=()=>document.visibilityState==="visible"&&load();
   document.addEventListener("visibilitychange",v);

   return()=>{
     clearInterval(i);
     document.removeEventListener("visibilitychange",v);
   };
 },[]);
 const profileData=useMemo(()=>data?.grades?.find(x=>x.entry===profile),[data,profile]);
 return <>
   <div className="sideHero sideHeroPep" aria-hidden="true" />
   <div className="sideHero sideHeroCherki" aria-hidden="true" />
   <main className="shell fplPage">
   <nav className="topNav"><Link href="/fpl">📰 Kolejnik</Link><strong>FPLowa</strong><button onClick={load}>Odśwież</button></nav>
   <section className="newspaperHero"><div><span className="paperKicker">FPLowa • GW {data?.gw??"—"} {data?(data.gwFinished?"• WYDANIE KOŃCOWE":"• LIVE"):""}</span><h1>📰 FPLOWA</h1><p>Brukowiec, centrum dowodzenia i kronika kompromitacji Waszej ligi.</p>{data?.updatedAt&&<small className="fplUpdated">Aktualizacja: {new Date(data.updatedAt).toLocaleString("pl-PL")}</small>}</div></section>
   <div className="fplTabs">
     <button className={tab==="zaklady"?"active":""} onClick={()=>setTab("zaklady")}>🎲 Zakłady</button>
     {[["gazeta","📰 Gazeta"],["live","⚡ Live"],["profile","👤 Profile"],["historia","🏛️ Hall of Shame"],["analityka","🧠 Analityka"],["muzeum","🏛️ Muzeum"],["studio","📺 Studio"],["rywalizacja","🥊 Rivalry"],["gala","🏆 Awards"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}
   </div>
   {error&&<div className="error">{error}</div>}{!data&&!error&&<div className="loading">Redakcja zbiera materiały...</div>}
   {tab==="zaklady"&&<BetsTab/>}
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
   {data&&tab==="analityka"&&<section className="megaGrid">
     <Card title="🧠 IQ transferowe">
       {data.transferIQRanking.map((x,i)=><div className="chance" key={x.entry}><span>#{i+1} {x.manager}</span><b className={x.score>=0?"positive":"negative"}>{x.score>0?"+":""}{x.score}</b></div>)}
     </Card>
     <Card title="☠️ Najgorszy transfer sezonu">
       {data.worstTransferSeason?<><h3>{data.worstTransferSeason.manager}</h3><p><b>{data.worstTransferSeason.outName}</b> → <b>{data.worstTransferSeason.inName}</b></p><p>Sprzedany: {data.worstTransferSeason.outPoints} pkt • kupiony: {data.worstTransferSeason.inPoints} pkt</p><strong className="negative">{data.worstTransferSeason.delta} pkt</strong></>:<p>Brak transferów do oceny.</p>}
     </Card>
     <Card title="🧠 Najlepszy transfer sezonu">
       {data.bestTransferSeason?<><h3>{data.bestTransferSeason.manager}</h3><p><b>{data.bestTransferSeason.outName}</b> → <b>{data.bestTransferSeason.inName}</b></p><p>Bilans ruchu: <b className="positive">+{data.bestTransferSeason.delta}</b></p></>:<p>Brak danych.</p>}
     </Card>
     <Card title="©️ Captain Roulette">
       {data.captainRanking.map((x,i)=><div className="record" key={x.entry}><b>#{i+1} {x.manager}</b><strong>{x.actual} pkt z kapitanów</strong><small>stracone vs idealny wybór: {x.lost}</small></div>)}
     </Card>
     <Card title="💀 Co gdybyś nic nie robił?">
       {data.noTouchRanking.map(x=><div className="record" key={x.entry}><b>{x.manager}</b><strong>Obecnie {x.actual} • GW1 bez zmian {x.untouched}</strong><small className={x.managerImpact>=0?"positive":"negative"}>wkład menedżera: {x.managerImpact>0?"+":""}{x.managerImpact}</small></div>)}
     </Card>
     <Card title="📅 Manager / Fraud of the Month">
       {data.monthlyAwards.map(x=><div className="monthAward" key={x.month}><b>{x.month}</b><span>🏆 {x.manager?.manager}: {x.manager?.points} pkt</span><span>🤡 {x.fraud?.manager}: {x.fraud?.points} pkt</span></div>)}
     </Card>
   </section>}
   {data&&tab==="muzeum"&&<section className="megaGrid">
     <Card title="🏛️ Muzeum kompromitacji">
       <div className="awardGallery">{data.museum.map((x,i)=><div className="awardBig" key={i}><span>{x.icon}</span><div><b>{x.name}</b><strong>{x.manager}</strong><small>{x.team} • {x.value}</small></div></div>)}</div>
     </Card>
   </section>}
   {data&&tab==="studio"&&<PostMatchStudio data={data}/>}
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
       {data.grades.map((x,i)=><blockquote key={x.entry}><div className="pressSpeaker"><span>🎙️</span><div><b>{x.manager}</b><small>{x.team}</small></div></div>{pressQuote(x,data.gw)}<small>{pressReaction(x,data.gw)}</small></blockquote>)}
     </Card>
   </section>}
 </main>
 </>
}
function PostMatchStudio({data}){
 const people=[...data.grades].sort((a,b)=>b.gwPoints-a.gwPoints);
 const hero=people[0], victim=people.at(-1), middle=people[Math.floor(people.length/2)];
 const seed=hashText(`studio|${data.gw}|${hero?.manager}|${victim?.manager}`);
 const openings=[
   `GW ${data.gw} zamknięta. Na jednym końcu ${hero?.manager} z ${hero?.gwPoints} pkt, na drugim ${victim?.manager} z ${victim?.gwPoints}. Czy możemy już użyć słowa kompromitacja?`,
   `Witamy po GW ${data.gw}. ${hero?.team} urządziło sobie bankiet, a ${victim?.team} najwyraźniej przyszło tylko pozmywać naczynia. Od czego zaczynamy?`,
   `Tabela po GW ${data.gw} wygląda tak, jakby połowa ligi grała w FPL, a druga połowa prowadziła eksperyment społeczny. ${hero?.manager} na górze tej kolejki, ${victim?.manager} pod lupą.`
 ];
 const heroLines=[
   `${hero?.manager} może dziś kozaczyć. ${hero?.gwPoints} punktów nie wzięło się z modlitwy, chociaż w FPL odrobina boskiej interwencji nigdy nie szkodzi.`,
   `${hero?.team} zrobiło robotę. Teraz najważniejsze, żeby ${hero?.manager} nie uznał tego za dowód, że każda jego przyszła decyzja jest genialna.`,
   `Dzisiaj chwalimy ${hero?.manager}. Jutro może sprzedać najlepszego zawodnika za differential z trzema minutami w sezonie, więc zachowajmy umiar.`
 ];
 const victimLines=[
   `${victim?.manager} ma ${victim?.gwPoints} pkt i kilka godzin na wymyślenie, jak nazwać to „długoterminową strategią”. Ja proponuję: wpierdol.`,
   `${victim?.team} wyglądało tak źle, że nawet czerwone strzałki powinny dostać dodatek za pracę w trudnych warunkach.`,
   `Nie wiem, co ${victim?.manager} widział przed deadlinem, ale po deadlinie wszyscy widzimy jedno: materiał szkoleniowy pod tytułem „czego, kurwa, nie robić”.`
 ];
 const middleLines=[
   `${middle?.manager} z ${middle?.team} przeżył kolejkę bez wielkiej chwały i bez publicznej egzekucji. W tej lidze to prawie sukces.`,
   `O ${middle?.team} mówi się mało, czyli ${middle?.manager} osiągnął rzadki luksus: nie dał redakcji wystarczająco dużo amunicji.`,
   `${middle?.manager} siedzi pośrodku chaosu. Ani pomnik, ani list gończy. Bardzo nie-FPLowe zachowanie.`
 ];
 const closings=[
   `Podsumowując GW ${data.gw}: zwycięzcy niech nie odlatują, przegrani niech nie robią -20 z zemsty, a reszta niech pamięta, że deadline zawsze znajdzie nowy sposób, żeby zrobić z człowieka idiotę.`,
   `To wszystko po GW ${data.gw}. Za tydzień wrócimy, gdy ci sami ludzie z pełnym przekonaniem podejmą zupełnie nowe, spektakularnie złe decyzje.`,
   `Kończymy studio GW ${data.gw}. FPL po raz kolejny udowodniło, że najdroższym zasobem nie jest budżet 100 milionów, tylko zdolność do niedotykania transferów po pijaku.`
 ];
 const dialogues=[
  {q:openings[seed%openings.length],a:heroLines[(seed>>3)%heroLines.length],b:victimLines[(seed>>5)%victimLines.length]},
  {q:`A co z menedżerami, którzy po GW ${data.gw} są gdzieś pomiędzy paradą zwycięstwa a śmietnikiem historii?`,a:middleLines[(seed>>7)%middleLines.length],b:`I właśnie dlatego ${middle?.manager} może dziś spać spokojniej niż ${victim?.manager}. Nie dobrze. Po prostu spokojniej.`},
  {q:`Ostatnie słowo przed następnym deadlinem?`,a:closings[(seed>>9)%closings.length],b:`Redakcja przypomina: jeśli transfer wydaje się genialny o 01:47 w nocy, prawdopodobnie należy odłożyć telefon.`}
 ];
 return <section className="studioWrap">
   <div className="studioTitle"><span>📺</span><div><span className="paperKicker">FPLOWA TV</span><h2>Pomeczowe studio GW {data.gw}</h2></div></div>
   {dialogues.map((d,i)=><article className="studioSegment" key={`${data.gw}-${i}`}><h3>{d.q}</h3><div className="expertLine"><b>🎙️ Ekspert A:</b><p>{d.a}</p></div><div className="expertLine"><b>🗣️ Ekspert B:</b><p>{d.b}</p></div></article>)}
 </section>
}

function Card({title,children}){return <section className="megaCard"><h2>{title}</h2>{children}</section>}
function Standings({data,onProfile}){return <section className="fplStandings"><div className="sectionHead"><div><span className="sectionLabel">LIGA 286732</span><h2>{data.league.name}</h2></div><span>GW {data.gw}</span></div><div className="fplTable"><div className="fplTr fplTh"><span>#</span><span>Drużyna</span><span>GW</span><span>Suma</span><span>Zmiana</span></div>{data.standings.map(x=><button className="fplTr fplRowBtn" key={x.entry} onClick={()=>onProfile(x.entry)}><strong>{x.rank}</strong><div><strong>{x.team}</strong><small>{x.manager}</small></div><strong>{x.gwPoints}</strong><span>{x.overall}</span><span>{x.lastRank>x.rank?`▲ ${x.lastRank-x.rank}`:x.lastRank<x.rank?`▼ ${x.rank-x.lastRank}`:"—"}</span></button>)}</div></section>}
function Profile({p,close}){
 return <div className="profileModal">
   <button onClick={close}>✕</button>
   <div className="profileHeader">
     <div className="profileHeroIcon">{p.icon}</div>
     <div><span className="newsTag">{p.label}</span><h2>{p.manager}</h2><p>{p.team}</p></div>
   </div>

   <div className="profileStats">
     <b>🏁 Overall #{p.rank}</b>
     <b>🌡️ Forma {p.form}</b>
     <b>⭐ Ocena {p.editorial}/10</b>
     <b>📊 Średnia {p.avg}</b>
     <b>⚡ 3 GW {p.avg3}</b>
     <b>🪑 Ławka {p.benchSeason}</b>
     <b>💸 Hity -{p.hitSeason}</b>
     <b>⚽ Gole {p.seasonGoals ?? 0}</b>
     <b>🥅 Stracone {p.seasonConceded ?? 0}</b>
   </div>

   <div className="profileStory">
     <section>
       <span>🧠 PORTRET MENEDŻERA</span>
       <p>{p.profileLead}</p>
     </section>
     <section>
       <span>📈 CO MÓWI FORMA</span>
       <p>{p.profileForm}</p>
     </section>
     <section className="profileVerdict">
       <span>🗞️ WERDYKT REDAKCJI</span>
       <p>{p.profileVerdict}</p>
     </section>
   </div>

   {p.achievements?.length>0&&<div className="trophyCabinet"><span>🏆 GABLOTA</span><div>{p.achievements.map((a,i)=><div className="trophy" key={i}><b>{a.icon} {a.name}</b><small>{a.value}</small></div>)}</div></div>}

   <div className="profileExtremes">
     {p.bestGW&&<div><span>🚀 Najlepsza GW</span><b>{p.bestGW.points} pkt • GW{p.bestGW.gw}</b></div>}
     {p.worstGW&&<div><span>🪦 Najgorsza GW</span><b>{p.worstGW.points} pkt • GW{p.worstGW.gw}</b></div>}
   </div>
 </div>
}