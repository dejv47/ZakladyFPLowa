"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BetsTab } from "./BetsTab";
import { useSearchParams } from "next/navigation";

function pressQuote(p, gw){
 const banks=[
  [
   `Powiem tak: ten weekend wyglądał momentami jak sabotaż, tylko niestety wszystkie decyzje podpisywałem osobiście.`,
   `Mam ${p.avg3} średnio z ostatnich trzech GW i nie zamierzam robić z siebie pierdolonego wizjonera, bo FPL bardzo szybko leczy takie zapędy.`,
   `Jeżeli na ławce zostało ${p.benchSeason} punktów, to trudno — następnym razem może zostawię tam tych, którzy faktycznie nic nie zrobią.`,
   `Najważniejsze teraz to nie odpierdolić panicznego transferu pięć minut przed deadline'em. Znam siebie, więc niczego nie obiecuję.`
  ],
  [
   `Nie będę wam wciskał kitu o „procesie”, jeżeli wynik wygląda jak gówno. Proces ma dawać punkty, a nie ładne slajdy.`,
   `Jesteśmy na miejscu ${p.rank}. i dokładnie tyle warte są dziś wszystkie moje mądre analizy z piątku wieczorem.`,
   `Koszt hitów wynosi ${p.hitSeason}; czasem człowiek płaci cztery punkty za poprawę drużyny, a czasem cztery punkty za możliwość wkurwienia się dwa razy.`,
   `Szatnia jest spokojna. Ja mniej. Następne pytanie, zanim zacznę wymieniać nazwiska.`
  ],
  [
   `Patrzyłem na wynik i przez chwilę zastanawiałem się, czy aplikacja się nie zjebała. Niestety działała prawidłowo.`,
   `Forma ${p.avg3} nie jest czymś, co chcę oprawić w ramkę, ale przynajmniej dokładnie wiemy, gdzie jesteśmy.`,
   `${p.benchSeason} punktów na ławce? Rezerwowi mogą się śmiać. Mają do tego pełne prawo, skurczybyki.`,
   `Nie będzie rewolucji. Będzie analiza, kawa i prawdopodobnie kilka bardzo niecenzuralnych słów przy ekranie transferów.`
  ],
  [
   `Ja naprawdę miałem plan. Problem polega na tym, że Premier League najwyraźniej nie dostała maila z tym planem.`,
   `Ocena ${p.editorial}/10 od redakcji mnie nie rusza. Trochę rusza. Dobra, wkurwia mnie.`,
   `Nie zamierzam kopiować wszystkich ruchów rywali tylko dlatego, że ich zawodnicy nagle zaczęli punktować jak pojebani.`,
   `Do kolejnej GW podchodzimy spokojnie. Jeżeli zobaczycie trzy transfery za minus osiem, uznajcie, że ta wypowiedź się zdezaktualizowała.`
  ],
  [
   `To nie był masterclass. To nawet nie był class. Momentami to była pierdolona przerwa obiadowa.`,
   `Mamy ${p.avg3} średnio z trzech kolejek i tabela nie przyjmuje argumentu „ale expected points wyglądały dobrze”.`,
   `Ławka kosztuje mnie już ${p.benchSeason} punktów, więc chyba stworzyłem najlepszą drużynę rezerw w całej lidze.`,
   `Nie szukam winnych. Winny siedzi przed wami i za chwilę znowu otworzy stronę FPL.`
  ],
  [
   `Kiedy zamykałem skład, wszystko wyglądało logicznie. To jest właśnie najbardziej wkurwiająca część tej historii.`,
   `Pozycja ${p.rank}. nie jest powodem do paniki, ale też nie będę udawał, że mam ochotę urządzić paradę.`,
   `Za transfery oddałem ${p.hitSeason} punktów i każdy z nich pamiętam lepiej niż większość dobrych decyzji.`,
   `Teraz trzeba mieć jaja, niczego nie rozwalić bez potrzeby i pozwolić tej ekipie wreszcie zrobić swoją robotę.`
  ],
  [
   `Nie wiem, kto wymyślił tę grę, ale ewidentnie miał osobisty problem z ludzkim spokojem psychicznym.`,
   `Moja forma wynosi ${p.avg3}; można to nazwać statystyką, można też nazwać cotygodniowym testem charakteru.`,
   `${p.benchSeason} punktów poza XI wygląda źle, ale zapewniam, że patrzenie na nie na żywo wygląda jeszcze gorzej.`,
   `Nie będę teraz robił gwałtownych ruchów. Najpierw się prześpię, potem zrobię gwałtowne ruchy z pełną świadomością.`
  ],
  [
   `Dzisiaj nie będę pierdolił o pechu. Jak pech pojawia się co tydzień, to zaczyna mieć nazwisko menedżera.`,
   `Jestem ${p.rank}. i mam ${p.editorial}/10. Nie trzeba kończyć matematyki, żeby wiedzieć, czy mam się czym chwalić.`,
   `Rynek transferowy już zabrał ${p.hitSeason} punktów, więc kolejne genialne pomysły będą przechodziły kontrolę trzeźwości.`,
   `Kibicom mogę obiecać jedno: następny skład też będzie ustawiony z pełnym przekonaniem. I to mnie najbardziej przeraża.`
  ],
  [
   `Miał być zielony arrow, wyszła sekcja zwłok. Taki jest futbol, a właściwie takie jest to cholerne fantasy.`,
   `Średnia ${p.avg3} mówi jasno, czy ostatnie tygodnie były dobre; nie będę pudrował liczb jak rzecznik prasowy po 0:5.`,
   `Jeśli ${p.benchSeason} punktów siedzi na ławce, to najwyraźniej mam świetne oko do zawodników i fatalne oko do ustawiania ich we właściwym miejscu.`,
   `Idziemy dalej. Nie dlatego, że mam wielką przemowę motywacyjną, tylko dlatego, że następny deadline i tak przyjdzie.`
  ],
  [
   `Przed kolejką byłem pewny siebie. Po kolejce jestem przede wszystkim bogatszy o kilka nowych przekleństw.`,
   `Miejsce ${p.rank}. to aktualny stan faktyczny, a nie opinia hejterów, więc trzeba to kurwa przyjąć.`,
   `Hity na poziomie ${p.hitSeason} są rachunkiem za moje przekonanie, że zawsze da się coś jeszcze „ulepszyć”.`,
   `Na razie nikogo nie wyrzucam. Po pierwszym price rise nie gwarantuję już absolutnie niczego.`
  ],
  [
   `Nie mam zamiaru robić konferencji w stylu „byliśmy lepsi niż wynik”. W FPL wynik jest całym pieprzonym sensem zabawy.`,
   `Forma ${p.avg3} i nota ${p.editorial}/10 dają materiał do analizy, ale nie do wymyślania bajek.`,
   `Ławka uzbierała ${p.benchSeason}; może powinienem następnym razem ustawić skład przez odwrócenie telefonu ekranem do dołu.`,
   `Przed następną GW potrzebujemy mniej geniuszu, więcej normalności i zero transferów robionych podczas siedzenia na kiblu.`
  ],
  [
   `Ta kolejka była jak kopnięcie w jaja od zawodnika, którego sam kupiłeś. Najgorsze, że jeszcze mu za to podziękowałeś transferem.`,
   `Ranking ${p.rank} nie kłamie, chociaż bardzo chciałbym dziś zgłosić reklamację.`,
   `${p.hitSeason} punktów za hity oraz ${p.benchSeason} na ławce to duet, którego nie zamawiałem, ale najwyraźniej dostałem w pakiecie.`,
   `Co dalej? Mniej kombinowania. A przynajmniej taki jest plan do momentu, aż zobaczę pierwszy bullshitowy tweet o kontuzji.`
  ]
 ];
 const slot=Math.abs(Number(p.entry))%banks.length;
 return `„${banks[slot].join(" ")}”`;
}

function pressReaction(p, gw){
 const banks=[
  `Redakcja: ${p.manager} właśnie wygłosił cztery zdania i każde pachniało człowiekiem, który wie, że jeden zły deadline dzieli go od kompletnego rozpierdolu.`,
  `Redakcja: konferencja ${p.manager} była bardziej uporządkowana niż część jego decyzji. Poprzeczka nie wisiała wysoko.`,
  `Redakcja: ${p.manager} nie szuka wymówek, co jest miłe. My za to bez problemu znajdujemy materiał do szydery.`,
  `Redakcja: w ${p.team} spokój oficjalny. Nieoficjalnie słychać nerwowe odświeżanie price predictorów.`,
  `Redakcja: ${p.manager} zachował twarz. Teraz wypadałoby jeszcze zachować punkty.`,
  `Redakcja: słowa rozsądne, ton stanowczy, historia decyzji nadal dostępna publicznie. Pech.`,
  `Redakcja: ${p.manager} brzmi dziś jak człowiek po terapii. Zobaczymy, czy efekt utrzyma się do deadline'u.`,
  `Redakcja: odpowiedzialność przyjęta. Czekamy, aż przyjmą się również jakieś sensowne transfery.`,
  `Redakcja: PR ${p.team} zdał egzamin. Komisja sportowa wciąż poprawia odpowiedzi.`,
  `Redakcja: ${p.manager} obiecał mniej chaosu. Bukmacherzy nie przyjmują zakładów na dotrzymanie tej obietnicy.`,
  `Redakcja: piękna przemowa. Gdyby FPL przyznawało punkty za samoświadomość, byłaby zielona strzałka.`,
  `Redakcja: ${p.manager} zakończył konferencję przed pierwszym pytaniem o wildcard. Rozsądna decyzja.`
 ];
 return banks[Math.abs(Number(p.entry))%banks.length];
}

export default function FPLPage(){
 const searchParams=useSearchParams();
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
     <button className={tab==="zaklady"?"active":""} onClick={()=>setTab("zaklady")}>🎲 Zakłady</button>
     {[["gazeta","📰 Gazeta"],["live","⚡ Live"],["profile","👤 Profile"],["historia","🏛️ Hall of Shame"],["rywalizacja","🥊 Rivalry"],["gala","🏆 Awards"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}
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