"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BetsTab } from "./BetsTab";

function managerKey(p){
 return `${p.manager}__${p.team}`.toLowerCase().replace(/\s+/g,"_");
}
function confHash(s){
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
 return h>>>0;
}
function confPick(arr, seed){ return arr[Math.abs(seed)%arr.length]; }

function conferenceMood(p, league){
 const pts=Number(p.gwPoints||0);
 const scores=(league||[]).map(x=>Number(x.gwPoints||0)).sort((a,b)=>a-b);
 const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:pts;
 const rank=[...(league||[])].sort((a,b)=>Number(b.gwPoints||0)-Number(a.gwPoints||0))
   .findIndex(x=>x.entry===p.entry)+1;
 const n=Math.max(scores.length,1);
 if(rank===1 || pts>=avg+12) return "great";
 if(rank>0 && rank<=Math.max(2,Math.ceil(n*.25))) return "good";
 if(rank>=Math.max(1,Math.ceil(n*.75)) || pts<=avg-12) return "bad";
 if(rank===n || pts<=avg-20) return "awful";
 return "neutral";
}

const CONF_BANK={
 great:{
  open:[
   "{M} wszedł po GW{GW} jak właściciel ligi, a nie jej uczestnik. {PTS} punktów daje dziś pełne prawo do bezczelnego uśmiechu.",
   "W siedzibie {T} po GW{GW} nie było konferencji kryzysowej. Było raczej kontrolowane chwalenie się wynikiem {PTS} pkt.",
   "{M} pojawił się przed mikrofonami po GW{GW} w nastroju człowieka, któremu tym razem FPL nie zdążyło napluć do kawy.",
   "Po GW{GW} {M} miał {PTS} powodów punktowych, żeby przez kilka minut udawać, że ta gra jest banalnie prosta.",
   "{T} właśnie zaliczyło kolejkę, po której nawet najwięksi hejterzy muszą na moment zamknąć mordę: {PTS} pkt."
  ],
  body:[
   "„Nie będę udawał skromnego. Dzisiaj decyzje siadły i wreszcie to ja patrzę na cudze czerwone strzałki jak na program rozrywkowy.”",
   "„Kapitan, skład i cierpliwość wreszcie nie działały przeciwko mnie. Aż dziwnie grać w FPL bez poczucia, że ktoś cię właśnie okradł.”",
   "„To była dobra robota, ale nie zamierzam teraz kupować pięciu differentiali tylko dlatego, że przez jeden weekend poczułem się jak geniusz.”",
   "„Najbardziej cieszy mnie, że tym razem plan przetrwał kontakt z rzeczywistością. W tej grze to prawie wydarzenie historyczne.”",
   "„Mogę dziś kozaczyć, ale deadline szybko leczy z pychy. Dlatego celebracja kończy się zanim zacznę wierzyć we własne tweety.”"
  ],
  end:[
   "„Za tydzień chcę potwierdzenia, nie pomnika. Jedna świetna GW nie daje immunitetu na kolejne głupoty.”",
   "„Nie ruszam połowy składu po sukcesie. Brzmi oczywiście, ale znam siebie, więc wolę powiedzieć to publicznie.”",
   "„Dzisiaj piwo za wynik, jutro znowu analiza. FPL bardzo szybko zmienia bohatera w mema.”",
   "„Niech rywale się martwią. Ja pierwszy raz od dawna nie muszę.”"
  ]
 },
 good:{
  open:[
   "{M} po GW{GW} wyglądał na zadowolonego, ale jeszcze nie na tyle, żeby zamawiać mural pod stadionem {T}. Wynik: {PTS} pkt.",
   "{T} wyszło z GW{GW} z {PTS} punktami i bez potrzeby wzywania egzorcysty do aplikacji FPL.",
   "Po solidnej GW{GW} {M} usiadł przed mikrofonem spokojnie. {PTS} pkt to nie orgazm, ale zdecydowanie nie powód do płaczu.",
   "{M} przyjął gratulacje za GW{GW} z ostrożnością człowieka, który wie, że następny deadline już ostrzy nóż.",
   "W {T} panuje umiarkowany optymizm: {PTS} pkt, kilka trafionych decyzji i wyjątkowo mało powodów, żeby wyjebać telefon przez okno."
  ],
  body:[
   "„Było dobrze. Nie idealnie, ale w FPL człowiek szybko uczy się szanować weekend, po którym nie musi usuwać aplikacji.”",
   "„Kilka decyzji siadło, kilka można było zrobić lepiej. Najważniejsze, że nie muszę dziś wymyślać teorii o pechu.”",
   "„Nie wygrałem świata, ale też nie zrobiłem z siebie idioty. W naszej lidze to całkiem wartościowy kompromis.”",
   "„Forma idzie w dobrą stronę. Teraz trzeba tylko nie zepsuć jej transferem wykonanym z nudów.”",
   "„Jest zielona energia. Nie będę jej zabijał panicznym -8 tylko dlatego, że ktoś strzelił dwa gole w sobotę.”"
  ],
  end:[
   "„Bierzemy punkty i spierdalmy z konferencji zanim ktoś zapyta o ławkę.”",
   "„Następna GW ma być kontynuacją, nie eksperymentem medycznym na własnym składzie.”",
   "„Jest dobrze, więc największym zagrożeniem dla {T} jestem teraz prawdopodobnie ja sam.”",
   "„Bez fajerwerków. Wystarczy, że tabela zaczyna wyglądać trochę mniej obraźliwie.”"
  ]
 },
 neutral:{
  open:[
   "GW{GW} nie dała {M} ani powodów do parady, ani podstaw do emigracji. {PTS} punktów i klasyczne FPL-owe „meh”.",
   "{M} przyszedł po GW{GW} z wynikiem {PTS} pkt. Dokładnie takim, przy którym nie wiesz, czy pić za sukces, czy z rozczarowania.",
   "W {T} po GW{GW} atmosfera była jak wynik: ani dobrze, ani tragicznie, po prostu człowiek patrzy i wzrusza ramionami.",
   "{PTS} punktów w GW{GW} zostawiło {M} w najbardziej irytującym miejscu FPL — bez katastrofy, ale też bez czym się pochwalić.",
   "Konferencja {T} po GW{GW} zaczęła się od słowa „średnio”. Redakcja uznała, że tym razem analiza może się na tym właściwie zakończyć."
  ],
  body:[
   "„Nie było tragedii, ale jeśli chcemy coś ugrać, samo niebycie tragicznym to trochę chujowy plan.”",
   "„Część składu zrobiła swoje, reszta wyglądała jak statyści. Czyli standardowy weekend fantasy.”",
   "„Nie będę robił rewolucji po przeciętnej kolejce. To właśnie rewolucje po przeciętnych kolejkach robią z ludzi późniejszych pacjentów.”",
   "„Wynik nie boli, ale też nie daje satysfakcji. To taki remis 0:0 z FPL, którego nikt nie będzie wspominał.”",
   "„Mam kilka rzeczy do poprawy, ale żadna nie wymaga od razu detonowania wildcarda.”"
  ],
  end:[
   "„Zapominamy o tej kolejce. Ani do muzeum, ani do gabloty.”",
   "„Następnym razem chcę dać redakcji powód do chwalenia albo przynajmniej ciekawszego wyśmiewania.”",
   "„Punkty dopisane. Emocje można było zostawić w domu.”",
   "„Niech GW{GW} zostanie tam, gdzie jej miejsce: w historii, najlepiej bez powtórki.”"
  ]
 },
 bad:{
  open:[
   "{M} wszedł po GW{GW} z miną człowieka, który już wie, że pierwsze pytanie będzie o te jebane {PTS} punktów.",
   "W {T} po GW{GW} nikt nie mówił o pechu. Przy {PTS} pkt pech byłby wręcz zbyt uprzejmym określeniem.",
   "Konferencję po GW{GW} rozpoczęto bez muzyki. {M} uznał, że wynik {PTS} pkt sam w sobie jest wystarczająco smutnym soundtrackiem.",
   "{M} po GW{GW} wyglądał, jakby właśnie zobaczył własną ławkę, kapitana i transfery jednocześnie. {PTS} pkt nie poprawiało humoru.",
   "{T} zaliczyło kolejkę z kategorii „proszę usunąć historię przeglądania”. {M}: {PTS} punktów i sporo materiału do aktu oskarżenia."
  ],
  body:[
   "„Nie będę pierdolił o procesie. Zagrałem słabo i kilka decyzji zasługuje na natychmiastowe przesłuchanie.”",
   "„Najgorsze jest to, że przed deadlinem wszystko wydawało mi się logiczne. To trochę przerażające.”",
   "„Jeżeli mój następny pomysł będzie równie genialny, liczę, że ktoś fizycznie odsunie mnie od klawiatury.”",
   "„Nie będę karał całego składu za własną głupotę. Najpierw wypadałoby ukarać menedżera.”",
   "„Ta kolejka pokazała, że można analizować przez tydzień i nadal dojść do spektakularnie złej odpowiedzi.”"
  ],
  end:[
   "„Nie robię panicznych transferów. Powtarzam to teraz głównie po to, żebym sam to, kurwa, usłyszał.”",
   "„Za tydzień chcę punktów, nie kolejnej konferencji terapeutycznej.”",
   "„GW{GW} idzie do kosza. Oby razem z częścią moich pomysłów.”",
   "„Kibice {T} mają prawo być wkurwieni. Ja też jestem, tylko niestety na siebie.”"
  ]
 },
 awful:{
  open:[
   "Po GW{GW} {M} wszedł do sali, ale wynik {PTS} pkt wszedł tam pierwszy i od razu zaczął go napierdalać krzesłem.",
   "{T} właśnie rozegrało fantasy odpowiednik pożaru śmietnika. {PTS} punktów i nawet śmietnik prosi o nieporównywanie.",
   "Przy {PTS} punktach w GW{GW} konferencja {M} była formalnością. Akt oskarżenia zdążyła wcześniej napisać tabela.",
   "{M} po GW{GW} nie szukał wymówek. Przy {PTS} pkt nawet wymówki odmówiły występu z powodu wstydu.",
   "To nie była słaba GW{GW}. To był zamach na ranking {T}, a głównym podejrzanym pozostaje jego własny menedżer."
  ],
  body:[
   "„To było gówno. Nie 'poniżej oczekiwań', nie 'trudny weekend'. Gówno. Możemy przejść do następnego pytania.”",
   "„Jeżeli ktoś chce zobaczyć, jak nie prowadzić drużyny fantasy, chętnie udostępnię historię decyzji. Materiał jest kompletny.”",
   "„Mój kapitan, transfery i ławka stworzyli dziś koalicję przeciwko mnie. Niestety wszystkich wybrałem osobiście.”",
   "„Nie mam prawa narzekać na pecha, kiedy sam podałem FPL nabity pistolet i poprosiłem, żeby strzeliło mi w stopę.”",
   "„Najrozsądniejszym ruchem po tej kolejce może być niedotykanie niczego, łącznie z aplikacją.”"
  ],
  end:[
   "„Przepraszam kibiców {T}. Następna kolejka nie może być gorsza, chociaż po tym weekendzie boję się wypowiadać takie zdania.”",
   "„Jeśli zobaczycie ode mnie -16 przed kolejną GW, zgłoście konto jako przejęte.”",
   "„Zamykamy temat, gasimy światło i udajemy, że GW{GW} była błędem serwera.”",
   "„Dzisiaj nie ma planu naprawczego. Najpierw trzeba ustalić, co dokładnie tu, kurwa, eksplodowało.”"
  ]
 }
};

function renderConf(t,p,gw){
 return t.replaceAll("{M}",p.manager).replaceAll("{T}",p.team)
  .replaceAll("{GW}",String(gw)).replaceAll("{PTS}",String(p.gwPoints??0));
}

function pressQuote(p,gw,managerIndex,league){
 const mood=conferenceMood(p,league);
 const bank=CONF_BANK[mood];
 // Seed contains manager + GW + result. Therefore a manager receives a different
 // combination every gameweek and the tone follows the actual GW performance.
 const seed=confHash(`${managerKey(p)}|${gw}|${p.gwPoints}|${mood}`);
 const a=confPick(bank.open, seed + managerIndex*17 + gw*31);
 const b=confPick(bank.body, seed + managerIndex*43 + gw*67);
 const c=confPick(bank.end, seed + managerIndex*89 + gw*101);
 const unique=`Ta wypowiedź należy do ${p.manager} po GW${gw}; bilans kolejki to ${p.gwPoints} pkt, miejsce w tej GW: ${[...league].sort((x,y)=>Number(y.gwPoints||0)-Number(x.gwPoints||0)).findIndex(x=>x.entry===p.entry)+1}.`;
 return `„${renderConf(a,p,gw)} ${renderConf(b,p,gw)} ${renderConf(c,p,gw)}” ${unique}`;
}

function pressReaction(p,gw,managerIndex,league){
 const mood=conferenceMood(p,league);
 const reactions={
  great:["Redakcja: tym razem bez ironii — to była zajebista kolejka.","Redakcja: pełne prawo do kozaczenia, przynajmniej do następnego deadline'u.","Redakcja: rywale mogą przewinąć ten fragment. Będzie bolało."],
  good:["Redakcja: solidna robota. Bez pomnika, ale i bez policyjnej taśmy wokół składu.","Redakcja: zielona strzałka smakuje najlepiej bez panicznych transferów na deser.","Redakcja: było dobrze. Teraz najtrudniejsze — niczego nie spierdolić."],
  neutral:["Redakcja: kolejka tak średnia, że nawet szyderstwo nie chce się rozgrzać.","Redakcja: nikt nie umarł, nikt nie został bohaterem. Gramy dalej.","Redakcja: wynik do zapomnienia, ale przynajmniej nie do aktu oskarżenia."],
  bad:["Redakcja: czerwone światło. Menedżer przynajmniej zauważył, że sam stoi na torach.","Redakcja: było słabo i żaden wykres tego nie wypudruje.","Redakcja: terapia zakończona. Teraz poprosimy o punkty."],
  awful:["Redakcja: komisja śledcza zostaje powołana ze skutkiem natychmiastowym.","Redakcja: nie kopiujcie tego w domu. Ani w FPL. Zwłaszcza w FPL.","Redakcja: tę kolejkę należy zabezpieczyć w gablocie z napisem „dowody”."]
 };
 const arr=reactions[mood];
 return `${arr[(confHash(managerKey(p)+gw)+managerIndex)%arr.length]} [${p.manager} • GW${gw}]`;
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
     <Card title="💀 Co gdybyś nic nie robił?"><small>GW1 jest punktem startowym — różnica w GW1 zawsze wynosi 0. Od GW2 porównujemy z zamrożonym składem i kapitanem z GW1.</small>
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
       {data.grades.map((x,i)=><blockquote key={x.entry}><div className="pressSpeaker"><span>🎙️</span><div><b>{x.manager}</b><small>{x.team}</small></div></div>{pressQuote(x,data.gw,i,data.grades)}<small>{pressReaction(x,data.gw,i,data.grades)}</small></blockquote>)}
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