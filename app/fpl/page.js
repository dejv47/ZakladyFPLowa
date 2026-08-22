"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BetsTab } from "./BetsTab";

function pressQuote(p, gw, managerIndex){
 const scripts=[
  [
   `Powiem bez pierdolenia: jeśli coś dziś wyglądało jak sabotaż, to niestety sabotażysta siedzi właśnie przed wami.`,
   `Nie zamierzam udawać wizjonera tylko dlatego, że kilka decyzji weszło; FPL bardzo szybko leczy takie ego.`,
   `Ławka i transfery są moją odpowiedzialnością, więc nie będę zwalał winy na księżyc, pogodę ani algorytm.`,
   `Przed następnym deadline'em mam jeden cel: nie zrobić czegoś genialnego wyłącznie we własnej głowie.`,
   `Jeżeli znowu odjebię ruch pięć minut przed zamknięciem, możecie tę wypowiedź wydrukować i rzucić mi w twarz.`
  ],
  [
   `Nie kupuję narracji o pechu. Jak pech wraca co tydzień, to zaczyna wyglądać jak część sztabu szkoleniowego.`,
   `Tabela pokazuje prawdę brutalniej niż jakikolwiek dziennikarz, więc nie mam zamiaru pudrować gówna.`,
   `Każdy hit miał swoje uzasadnienie; problem w tym, że część uzasadnień po weekendzie brzmi jak zeznanie po pijaku.`,
   `Nie będziemy teraz przewracać składu do góry nogami tylko dlatego, że Twitter odkrył nowego must-have'a.`,
   `Najpierw chłodna analiza, potem transfer. Przynajmniej taki jest oficjalny plan, zanim otworzę aplikację.`
  ],
  [
   `Przez chwilę myślałem, że punkty na ekranie są błędem. Niestety jedynym błędem byłem miejscami ja.`,
   `Nie będę gadał o expected points, jeżeli actual points wyglądają jak rachunek za głupotę.`,
   `Rezerwowi mają pełne prawo patrzeć na mnie z pogardą, kiedy siedzą z haulami obok ludzi blankujących w podstawie.`,
   `Nie potrzebujemy wielkiej rewolucji, potrzebujemy kilku normalnych decyzji z rzędu, co brzmi prościej niż jest.`,
   `Kolejna GW pokaże, czy wyciągnęliśmy wnioski, czy tylko nauczyliśmy się ładniej o nich opowiadać.`
  ],
  [
   `Miałem plan i nadal mam plan. Problem jest taki, że Premier League regularnie ma własny plan i ma mój w dupie.`,
   `Oceny redakcji mnie podobno nie obchodzą, ale oczywiście pierwsze co robię, to je czytam i się wkurwiam.`,
   `Nie będę kopiował rywali jak bezmyślna owca tylko dlatego, że ich zawodnik zrobił piętnaście punktów w jednym meczu.`,
   `Jeżeli dokonam transferu, chcę wiedzieć po co go robię, a nie obudzić się w sobotę z minus osiem i kacem decyzyjnym.`,
   `Spokojna głowa jest teraz ważniejsza niż kolejny pieprzony differential znaleziony na X o pierwszej w nocy.`
  ],
  [
   `To nie był masterclass. To nawet nie stało obok masterclassu na parkingu.`,
   `Kiedy drużyna wygląda źle, menedżer może mówić o procesie albo przyznać, że coś zjebał; wybieram drugą opcję.`,
   `Mam bardzo dobrą kadrę rezerwowych, co byłoby świetną wiadomością, gdyby ta gra dawała za nich wszystkie punkty.`,
   `Nie szukam kozła ofiarnego, bo musiałbym postawić lustro na środku konferencji.`,
   `Następny tydzień poświęcamy na ograniczenie twórczości własnej i zwiększenie liczby normalnych decyzji.`
  ],
  [
   `Najbardziej boli mnie to, że przed deadline'em wszystko wydawało się logiczne. Logika po weekendzie uciekła bez pożegnania.`,
   `Nie będę panikował z powodu miejsca w tabeli, ale nie będę też robił z niego dekoracji na ścianę.`,
   `Każdy minus za transfer pamięta się dłużej niż dobry darmowy ruch, taka jest ta cholerna gra.`,
   `W tej chwili potrzebuję bardziej cierpliwości niż nowego zawodnika, co jest dla mnie wyjątkowo niewygodne.`,
   `Jeżeli zespół zrobi swoje, nic nie ruszam. Jeżeli nie zrobi, nie ręczę za stan kadry w piątek wieczorem.`
  ],
  [
   `Twórca FPL musiał mieć osobisty konflikt z ludzkim spokojem, bo inaczej nie da się wytłumaczyć tej gry.`,
   `Statystyki pokazują formę, ale nie pokazują liczby razy, kiedy człowiek patrzy na ławkę i mówi „ja pierdolę”.`,
   `Nie chcę gwałtownych ruchów, bo gwałtowne ruchy są dokładnie tym, co najczęściej wpędza mnie w to gówno.`,
   `Zawodnicy mają dostać zaufanie, a ja mam przestać traktować jeden blank jak wezwanie do przebudowy całego klubu.`,
   `Najpierw sen, później decyzje. To brzmi banalnie, a w FPL jest niemal przełomową metodologią.`
  ],
  [
   `Dziś nie będę mówił o pechu, bo po pewnym czasie „pech” staje się bardzo eleganckim słowem na złe zarządzanie.`,
   `Nie jestem zadowolony z rankingu i nie mam zamiaru opowiadać, że tabela nie pokazuje całego obrazu. Pokazuje wystarczająco dużo.`,
   `Rynek transferowy już kilka razy dostał ode mnie punkty w prezencie i ten program charytatywny musi się skończyć.`,
   `Każdy następny ruch będzie przechodził test: czy robię go z powodu danych, czy dlatego, że właśnie się wkurwiłem.`,
   `Kibicom obiecuję jedno — jeśli znowu coś odjebę, przynajmniej nie będę później udawał, że było to genialne.`
  ],
  [
   `Miał być zielony arrow, a przez moment wyglądało to jak sekcja zwłok własnego rankingu.`,
   `Nie będę pudrował średnich punktów słowami o przewadze optycznej, bo to nie jest Premier League i nikt nie daje punktów za styl.`,
   `Kiedy najlepiej punktują ludzie na ławce, trener ma dwa wyjścia: mówić o pechu albo spojrzeć w lustro. Lustro wygrało.`,
   `W kolejnym tygodniu chcę mniej narracji, mniej przekombinowania i zdecydowanie mniej genialnych pomysłów po alkoholu.`,
   `Deadline przyjdzie bez względu na naszą traumę, więc trzeba się ogarnąć i zachowywać jak dorośli. Przynajmniej przez godzinę.`
  ],
  [
   `Przed kolejką byłem pewny swoich decyzji. Teraz jestem pewny głównie tego, że FPL potrafi upokorzyć każdego.`,
   `Ranking jest faktem, nie hejtem, więc zamiast się obrażać trzeba zacząć robić rzeczy, które dają punkty.`,
   `Mam słabość do poprawiania składu, nawet kiedy skład nie prosi o poprawę; to choroba zawodowa.`,
   `Nie będziemy kupować każdego zawodnika, który raz zrobi dwucyfrówkę, bo wtedy za miesiąc będę miał piętnastu ludzi i zero planu.`,
   `Po konferencji wyłączam social media, zanim jakiś thread przekona mnie do kolejnego kretyńskiego ruchu.`
  ],
  [
   `Nie będę mówił, że byliśmy lepsi niż wynik. W FPL wynik jest jedyną rzeczą, która naprawdę obchodzi tabelę.`,
   `Dane są ważne, ale dane nie mogą być alibi dla kapitana, który przynosi tyle punktów co worek ziemniaków.`,
   `Jeżeli ktoś jeszcze zobaczy mnie robiącego transfer podczas siedzenia na kiblu, ma pełne prawo zabrać mi telefon.`,
   `Potrzebujemy mniej kombinowania, więcej prostych ruchów i choć jednego weekendu bez poczucia, że sami sobie robimy krzywdę.`,
   `Nie oczekuję cudów. Oczekuję tylko, że przestaniemy produkować problemy, których wcześniej nie mieliśmy.`
  ],
  [
   `Ta kolejka była jak kopnięcie w jaja od zawodnika, którego sam kupiłeś i jeszcze dałeś mu opaskę.`,
   `Nie zgłaszam reklamacji na tabelę, bo niestety wszystkie paragony z głupich decyzji są moje.`,
   `Jeżeli hity i ławka zaczynają tworzyć duet, który kosztuje więcej niż połowa składu zdobywa, czas przerwać eksperyment.`,
   `Nie zamierzam obiecywać, że przestanę kombinować, bo nikt by w to nie uwierzył. Mogę obiecać, że spróbuję kombinować trochę mądrzej.`,
   `Następny bullshitowy tweet o urazie nie może sterować moim życiem. To jest mój cel rozwojowy na ten tydzień.`
  ]
 ];
 const script=scripts[managerIndex % scripts.length];
 const statSentence=`W liczbach wygląda to tak: forma ${p.avg3}, ławka ${p.benchSeason}, hity ${p.hitSeason}, miejsce ${p.rank}; i każda z tych liczb daje mi inny powód do ${p.editorial>=6?"ostrożnego optymizmu":"przeklinania"}.`;
 return `„${[script[0], statSentence, ...script.slice(1)].join(" ")}”`;
}

function pressReaction(p, gw, managerIndex){
 const reactions=[
  `Redakcja: dużo samoświadomości, niewiele immunitetu. Następny głupi deadline i wyciągamy ten cytat z archiwum.`,
  `Redakcja: brzmi rozsądnie, co jest niepokojące. Najgorsze decyzje często zaczynają się właśnie od poczucia, że wszystko jest pod kontrolą.`,
  `Redakcja: konferencja lepsza niż część występów. Na szczęście za PR nie ma punktów.`,
  `Redakcja: właściciel mówi o cierpliwości. Bukmacherzy nie chcą wystawić kursu, że wytrzyma do piątku.`,
  `Redakcja: samokrytyka przyjęta. Teraz prosimy o wersję praktyczną, najlepiej widoczną w zielonej strzałce.`,
  `Redakcja: wypowiedź profesjonalna, historia transferów nadal dostępna publicznie i psuje część efektu.`,
  `Redakcja: słowa o spokoju padły przekonująco. Palec na przycisku Confirm Transfers wygląda mniej przekonująco.`,
  `Redakcja: menedżer bierze odpowiedzialność, co jest eleganckim sposobem powiedzenia „tak, to ja to zjebałem”.`,
  `Redakcja: mniej wymówek niż zwykle, więcej konkretu. Niestety tabela nie daje premii za rozwój osobisty.`,
  `Redakcja: zapowiedź rozsądku brzmi dobrze. Czekamy na pierwszy price rise, który ją brutalnie zweryfikuje.`,
  `Redakcja: to była dobra konferencja dla człowieka, który następnie musi wrócić do znacznie trudniejszego zadania — ustawienia składu.`,
  `Redakcja: przynajmniej nikt nie powiedział „zaufajcie procesowi”. Za to przyznajemy symboliczny punkt.`
 ];
 return reactions[managerIndex % reactions.length];
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
       {data.grades.map((x,i)=><blockquote key={x.entry}><div className="pressSpeaker"><span>🎙️</span><div><b>{x.manager}</b><small>{x.team}</small></div></div>{pressQuote(x,data.gw,i)}<small>{pressReaction(x,data.gw,i)}</small></blockquote>)}
     </Card>
   </section>}
 </main>
 </>
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

   <div className="profileExtremes">
     {p.bestGW&&<div><span>🚀 Najlepsza GW</span><b>{p.bestGW.points} pkt • GW{p.bestGW.gw}</b></div>}
     {p.worstGW&&<div><span>🪦 Najgorsza GW</span><b>{p.worstGW.points} pkt • GW{p.worstGW.gw}</b></div>}
   </div>
 </div>
}