import { NextResponse } from "next/server";

const LEAGUE_ID = 286732;
const BASE = "https://fantasy.premierleague.com/api";

async function fpl(path) {
  const r = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    headers: { "User-Agent": "ZakladyLive/1.0" }
  });
  if (!r.ok) throw new Error(`FPL ${r.status}: ${await r.text()}`);
  return r.json();
}

function seeded(items, seed, count=2) {
  if (!items.length) return [];
  const arr=[...items];
  let x=(seed*9301+49297)%233280;
  arr.sort(()=>{ x=(x*9301+49297)%233280; return x/233280-.5; });
  return arr.slice(0, Math.min(count, arr.length));
}

export async function GET() {
  try {
    const [boot, league] = await Promise.all([
      fpl("/bootstrap-static/"),
      fpl(`/leagues-classic/${LEAGUE_ID}/standings/?page_standings=1`)
    ]);

    const finishedEvents = boot.events.filter(e => e.finished);
    const latestFinished = finishedEvents.at(-1);

    const current =
      boot.events.find(e => e.is_current) ||
      latestFinished ||
      boot.events.find(e => !e.finished) ||
      boot.events.at(-1);

    const gw = current?.id || 1;
    const gwFinished = !!current?.finished;

    // IMPORTANT: live GW points must come from /event/{gw}/live/.
    // bootstrap-static is metadata and should not be trusted for live article scoring.
    const [live, fixtures] = await Promise.all([
      fpl(`/event/${gw}/live/`).catch(() => ({ elements: [] })),
      fpl(`/fixtures/?event=${gw}`).catch(() => [])
    ]);

    const livePoints = Object.fromEntries(
      (live.elements || []).map(x => [x.id, Number(x.stats?.total_points || 0)])
    );

    const players = Object.fromEntries(boot.elements.map(p => [p.id, p]));
    const teams = Object.fromEntries(boot.teams.map(t => [t.id, t]));

    // A team counts as having played/started only when its GW fixture actually started.
    const teamFixtureState = {};
    for (const fx of fixtures || []) {
      const started = Boolean(fx.started) || Boolean(fx.finished) || Boolean(fx.finished_provisional);
      for (const teamId of [fx.team_h, fx.team_a]) {
        if (!teamFixtureState[teamId]) teamFixtureState[teamId] = { started: false, finished: false };
        teamFixtureState[teamId].started = teamFixtureState[teamId].started || started;
        teamFixtureState[teamId].finished =
          teamFixtureState[teamId].finished || Boolean(fx.finished) || Boolean(fx.finished_provisional);
      }
    }

    const entries = league.standings.results;
    const details = await Promise.all(entries.map(async row => {
      const [picks, hist, transfersAll] = await Promise.all([
        fpl(`/entry/${row.entry}/event/${gw}/picks/`).catch(()=>null),
        fpl(`/entry/${row.entry}/history/`).catch(()=>null),
        fpl(`/entry/${row.entry}/transfers/`).catch(()=>[])
      ]);
      const h = hist?.current?.find(x => x.event === gw);
      const squad=(picks?.picks||[]).map(x => {
        const p=players[x.element]||{};
        return {
          name: p.web_name || "???",
          club: teams[p.team]?.short_name || teams[p.team]?.name || "?",
          played: Boolean(teamFixtureState[p.team]?.started),
          finished: Boolean(teamFixtureState[p.team]?.finished),
          points:
            (teamFixtureState[p.team]?.started ? Number(livePoints[x.element] || 0) : 0)
            * Number(x.multiplier || 0),
          rawPoints:
            teamFixtureState[p.team]?.started ? Number(livePoints[x.element] || 0) : 0,
          captain: !!x.is_captain,
          multiplier: x.multiplier,
          position: x.position,
          ownership: Number(p.selected_by_percent || 0)
        };
      });
      const starters=squad.filter(x=>x.position<=11);
      const bench=squad.filter(x=>x.position>11);
      const captain=squad.find(x=>x.captain);
      const playedStarters = starters.filter(x => x.played);
      const best = playedStarters.slice().sort((a,b)=>b.rawPoints-a.rawPoints)[0] || null;
      const worst = playedStarters.slice().sort((a,b)=>a.rawPoints-b.rawPoints)[0] || null;
      return {
        entry: row.entry,
        team: row.entry_name,
        manager: row.player_name,
        rank: row.rank,
        lastRank: row.last_rank,
        total: row.total,
        gwPoints: Number(row.event_total ?? 0),
        overall: Number(row.total ?? 0),
        benchPoints:
          Number(picks?.entry_history?.points_on_bench ?? h?.points_on_bench ?? bench.reduce((s,x)=>s+x.rawPoints,0)),
        transferCost: h?.event_transfers_cost ?? 0,
        transfers: h?.event_transfers ?? 0,
        captain,
        captainHasPlayed: Boolean(captain?.played),
        best,
        worst,
        squad,
        gwTransfers: (transfersAll || [])
          .filter(t => Number(t.event) === Number(gw))
          .map(t => {
            const pin = players[t.element_in] || {};
            const pout = players[t.element_out] || {};
            return {
              inId: t.element_in,
              inName: pin.web_name || "???",
              inClub: teams[pin.team]?.short_name || teams[pin.team]?.name || "?",
              inPoints: teamFixtureState[pin.team]?.started ? Number(livePoints[t.element_in] || 0) : 0,
              inPlayed: Boolean(teamFixtureState[pin.team]?.started),
              outId: t.element_out,
              outName: pout.web_name || "???",
              outClub: teams[pout.team]?.short_name || teams[pout.team]?.name || "?",
              outPoints: teamFixtureState[pout.team]?.started ? Number(livePoints[t.element_out] || 0) : 0,
              outPlayed: Boolean(teamFixtureState[pout.team]?.started)
            };
          })
      };
    }));

    const sorted=[...details].sort((a,b)=>b.gwPoints-a.gwPoints);
    const bestGW=sorted[0], worstGW=sorted.at(-1);
    const benchKing=[...details].sort((a,b)=>b.benchPoints-a.benchPoints)[0];
    const hitKing=[...details].sort((a,b)=>b.transferCost-a.transferCost)[0];
    const randoms=seeded(details.filter(x=>![bestGW?.entry,worstGW?.entry].includes(x.entry)), gw, 2);

    // Build a larger pool of categories, score how relevant each one is
    // for this GW, then publish only the 10 strongest stories.
    const candidates = [];
    const finishWord = gwFinished ? "po zakończeniu kolejki" : "na ten moment";
    const variants = (arr, salt = 0) => arr[(gw + salt) % arr.length];
    const add = (score, article) => {
      if (article && Number.isFinite(score) && score > 0) candidates.push({ score, ...article });
    };

    const scoreRoasts = [
      "wynik wygląda jak efekt ustawiania składu po sześciu piwach i jednym urazie głowy",
      "to jest FPL-owy odpowiednik wejścia na boisko w klapkach i pretensji, że murawa śliska",
      "zarządzanie tym składem przypomina małpę napierdalającą losowe przyciski — z tą różnicą, że małpa czasem by trafiła",
      "projekt sportowy wygląda, jakby dyrektora wybrano w konkursie z paczki chipsów",
      "to nie był pech — to była pełnoprawna produkcja gówna na skalę przemysłową",
      "takiego wyniku nie da się osiągnąć przypadkiem; tutaj trzeba było konsekwentnie podejmować chujowe decyzje",
      "gdyby za głupotę przyznawali bonus points, właśnie mielibyśmy rekord FPL",
      "ten skład wygląda jak dowód rzeczowy w sprawie o znęcanie się nad własnym rankingiem",
      "nawet auto-pick patrzy na ten wynik i mówi: ja pierdolę",
      "to nie jest drużyna Fantasy Premier League, tylko jedenastoosobowy list pożegnalny do rankingu"
    ];
    const captainRoasts = [
      "opaska została wykorzystana z gracją człowieka próbującego otworzyć konserwę młotkiem",
      "wybór kapitana wygląda jak decyzja kompletnego dzbana pięć sekund przed deadline'em",
      "literka C najwyraźniej oznaczała tutaj „chujowy pomysł”",
      "kapitan był tak trafiony, jakby wybierał go niewidomy dartem",
      "opaska zrobiła więcej szkody psychicznej właścicielowi niż pożytku punktowego",
      "to nie był captaincy pick, tylko publiczne samookaleczenie rankingu",
      "trzeba mieć wyjątkowy talent, żeby dostać podwójne punkty i wykorzystać je akurat do podwojenia gówna",
      "menedżer spojrzał na jedenastu zawodników i z pełną świadomością wskazał akurat tego nieszczęśnika",
      "vice-captain powinien pozwać właściciela za zniesławienie",
      "opaska wyglądała na przyznaną w drodze losowania przeprowadzonego w ciemnej piwnicy"
    ];

    const ownerRoasts = [
      "Sztab analityczny tej drużyny najwyraźniej składa się z właściciela, kalkulatora bez baterii i złych przeczuć.",
      "Źródła donoszą, że menedżer nadal uważa swój plan za dobry. Źródła są zaniepokojone.",
      "Jeżeli to była strategia, to słowo „strategia” właśnie złożyło pozew o zniesławienie.",
      "Na miejscu kibiców tej drużyny domagalibyśmy się zwrotu punktów i badań psychiatrycznych dla działu transferowego.",
      "Redakcja próbowała znaleźć logiczne wytłumaczenie. Po trzech minutach stwierdziliśmy: jebać, nie da się.",
      "W normalnym klubie po czymś takim dyrektor sportowy oddaje identyfikator przy wyjściu.",
      "Menedżer udowadnia, że deadline nie jest najgroźniejszą rzeczą w FPL. Najgroźniejszy jest człowiek podejmujący decyzje przed deadline'em.",
      "Plan był odważny, świeży i kompletnie zjebany.",
      "To wygląda mniej jak zarządzanie drużyną, a bardziej jak zemsta na samym sobie.",
      "Najbardziej imponujące jest to, że wszystkie te decyzje były dobrowolne."
    ];

    const sorted = [...details].sort((a,b)=>b.gwPoints-a.gwPoints);
    const bestGW = sorted[0];
    const worstGW = sorted.at(-1);
    const benchKing = [...details].sort((a,b)=>b.benchPoints-a.benchPoints)[0];
    const hitKing = [...details].sort((a,b)=>b.transferCost-a.transferCost)[0];

    if (bestGW) add(90 + bestGW.gwPoints, {
      tag:"👑 KRÓL TEGO BURDELU",
      title:`${bestGW.team} rozjebało konkurencję. Rywale już produkują wymówki`,
      body:`${bestGW.manager} ma ${bestGW.gwPoints} pkt ${finishWord}. ${bestGW.best ? `${bestGW.best.name} (${bestGW.best.club}) dołożył ${bestGW.best.rawPoints} pkt i zrobił za pół składu robotę.` : ""} ${bestGW.captain ? (bestGW.captainHasPlayed ? `Kapitan ${bestGW.captain.name} dowiózł ${bestGW.captain.points} pkt po mnożniku.` : `Kapitan ${bestGW.captain.name} jeszcze nie grał, więc ten burdel może być jeszcze większy.`) : ""} Menedżer chodzi teraz jak Guardiola po mistrzostwie, choć tydzień temu prawdopodobnie sam nie wiedział, po co ma połowę tych piłkarzy.`
    });

    if (worstGW) add(100 + Math.max(0, bestGW.gwPoints-worstGW.gwPoints), {
      tag:"💩 KOMPROMITACJA KOLEJKI",
      title:`${worstGW.team}: ktoś powinien odebrać temu człowiekowi hasło do FPL`,
      body:`${worstGW.manager} ma ${worstGW.gwPoints} pkt, czyli najmniej w lidze. ${variants(scoreRoasts,1)}. ${worstGW.benchPoints ? `Na ławce kisi się ${worstGW.benchPoints} pkt, więc nawet rezerwowi patrzą na trenera jak na idiotę.` : ""} Zarząd milczy. Trudno się dziwić — co tu kurwa komentować. ${variants(ownerRoasts,11)}`
    });

    if (benchKing?.benchPoints > 0) add(75 + benchKing.benchPoints*3, {
      tag:"🪑 ŁAWKOWY GUARDIOLA",
      title:`${benchKing.team} zostawia ${benchKing.benchPoints} pkt na ławce. Piękny sabotaż`,
      body:`${benchKing.manager} miał punkty dosłownie w swojej drużynie i postanowił ich nie używać. ${benchKing.benchPoints} pkt oglądało mecz z ławki, podczas gdy podstawowa jedenastka próbowała udawać profesjonalny zespół. Rezerwowi powinni założyć grupę „bez tego debila” i od następnej GW sami ustawiać skład. ${variants(ownerRoasts,12)}`
    });

    if (hitKing?.transferCost > 0) add(70 + hitKing.transferCost*5, {
      tag:"💸 FINANCIAL FAIR PLAY",
      title:`${hitKing.team} samo sobie zajebało ${hitKing.transferCost} pkt za transfery`,
      body:`${hitKing.manager} wykonał ${hitKing.transfers} transferów i zapłacił ${hitKing.transferCost} pkt. To strategia dyrektora sportowego z Temu: najpierw rozpierdolić własny wynik, a potem modlić się, żeby nowe nabytki go odzyskały. Efekt GW: ${hitKing.gwPoints} pkt. ${variants(ownerRoasts,13)}`
    });

    const captainCandidates = details.filter(x=>x.captain&&x.captainHasPlayed)
      .sort((a,b)=>(a.captain?.points||0)-(b.captain?.points||0));
    const capFail = captainCandidates[0];
    if (capFail) add(70 + Math.max(0,12-(capFail.captain?.points||0))*4, {
      tag:"©️ KAPITAN DEBIL",
      title:`${capFail.team} zaufało ${capFail.captain.name}. No i po chuj?`,
      body:`${capFail.manager} dał opaskę ${capFail.captain.name} (${capFail.captain.club}), który po mnożniku dał ${capFail.captain.points} pkt. ${variants(captainRoasts,3)}. ${capFail.best&&capFail.best.name!==capFail.captain.name ? `Tymczasem ${capFail.best.name} zrobił ${capFail.best.rawPoints} pkt bez tej zaszczytnej literki C.` : ""}`
    });

    // Frajer kolejki / transfer z dupy: sold player outscored the replacement.
    const transferFails = details.flatMap(x => (x.gwTransfers||[]).map(t=>({owner:x,...t})))
      .filter(t=>t.inPlayed && t.outPlayed && t.outPoints > t.inPoints)
      .sort((a,b)=>(b.outPoints-b.inPoints)-(a.outPoints-a.inPoints));
    const tf = transferFails[0];
    if (tf) add(85 + (tf.outPoints-tf.inPoints)*5, {
      tag:"🤡 FRAJER KOLEJKI",
      title:`${tf.owner.team} wyrzuca ${tf.outName}, a ten odpowiada ${tf.outPoints} punktami`,
      body:`${tf.owner.manager} sprzedał ${tf.outName} (${tf.outClub}) i kupił ${tf.inName} (${tf.inClub}). Nowy nabytek zrobił ${tf.inPoints} pkt, stary ${tf.outPoints}. Różnica: ${tf.outPoints-tf.inPoints} pkt prosto w mordę. Rynek transferowy właśnie wystawił rachunek za bycie mądrzejszym od wszystkich.`
    });

    // 200 IQ / Differential Chad.
    const diffs = details.flatMap(x => x.squad.filter(p=>p.position<=11&&p.played&&p.ownership<10&&p.rawPoints>=7).map(p=>({owner:x,p})))
      .sort((a,b)=>b.p.rawPoints-a.p.rawPoints);
    const diff = diffs[0];
    if (diff) add(75 + diff.p.rawPoints*3 + Math.max(0,10-diff.p.ownership), {
      tag:"🦄 DIFFERENTIAL CHAD",
      title:`${diff.owner.team} wyciąga ${diff.p.name} z kapelusza i wygląda jak pieprzony geniusz`,
      body:`${diff.p.name} z ${diff.p.club} ma tylko ${diff.p.ownership.toFixed(1)}% ownershipu, a dowiózł ${diff.p.rawPoints} pkt. ${diff.owner.manager} może przez tydzień opowiadać, że „widział underlying numbers”, choć równie dobrze mógł po prostu mieć niewiarygodnego farta.`
    });

    // Sheep: highest average ownership among starters.
    const sheep = details.map(x=>({
      ...x,
      avgOwn:x.squad.filter(p=>p.position<=11).reduce((s,p)=>s+p.ownership,0)/Math.max(1,x.squad.filter(p=>p.position<=11).length)
    })).sort((a,b)=>b.avgOwn-a.avgOwn)[0];
    if (sheep) add(40 + sheep.avgOwn, {
      tag:"🐑 OWCA KOLEJKI",
      title:`${sheep.team}: skład ustawił Twitter, właściciel tylko kliknął Save`,
      body:`Średni ownership podstawowej jedenastki ${sheep.manager} to ${sheep.avgOwn.toFixed(1)}%. Differential? Ryzyko? Własna myśl? Po chuj, skoro można skopiować template i modlić się razem z połową internetu. Wynik: ${sheep.gwPoints} pkt.`
    });

    // One-man army.
    const armies = details.map(x=>{
      const p=x.best;
      const share=p&&x.gwPoints>0 ? p.rawPoints/x.gwPoints : 0;
      return {owner:x,p,share};
    }).filter(x=>x.p&&x.share>=0.25).sort((a,b)=>b.share-a.share);
    const army=armies[0];
    if (army) add(55 + army.share*100, {
      tag:"🔥 JEDNOOSOBOWA ARMIA",
      title:`Bez ${army.p.name} ${army.owner.team} wyglądałoby jak drużyna złożona z pachołków`,
      body:`${army.p.name} (${army.p.club}) zdobył ${army.p.rawPoints} pkt, czyli około ${Math.round(army.share*100)}% całego wyniku ${army.owner.team}. Reszta składu mogłaby równie dobrze siedzieć w pubie. ${army.owner.manager} powinien wysłać mu kwiaty i połowę premii.`
    });

    // Parasites: worst three played starters.
    const parasiteOwners=details.map(x=>{
      const three=x.squad.filter(p=>p.position<=11&&p.played).sort((a,b)=>a.rawPoints-b.rawPoints).slice(0,3);
      return {owner:x,three,total:three.reduce((s,p)=>s+p.rawPoints,0)};
    }).filter(x=>x.three.length===3).sort((a,b)=>a.total-b.total);
    const parasites=parasiteOwners[0];
    if(parasites) add(58 + Math.max(0,9-parasites.total)*4, {
      tag:"🗑️ PASOŻYTY KOLEJKI",
      title:`Trzech gagatków z ${parasites.owner.team} uzbierało razem ${parasites.total} pkt`,
      body:`${parasites.three.map(p=>`${p.name} (${p.club}) — ${p.rawPoints}`).join(", ")}. To nie jest trzon zespołu, tylko jebany hamulec ręczny. ${parasites.owner.manager} wystawił ich wszystkich i teraz może spokojnie zastanawiać się, gdzie w życiu popełnił błąd.`
    });

    // Biggest rise and fall.
    const riser=[...details].filter(x=>x.lastRank>x.rank).sort((a,b)=>(b.lastRank-b.rank)-(a.lastRank-a.rank))[0];
    if(riser) add(55+(riser.lastRank-riser.rank)*8,{
      tag:"📈 Z CHUJA DO BOHATERA",
      title:`${riser.team} pnie się o ${riser.lastRank-riser.rank} miejsc. Nagle wszyscy są ekspertami`,
      body:`${riser.manager} awansował z ${riser.lastRank}. na ${riser.rank}. miejsce dzięki ${riser.gwPoints} pkt. Jeszcze chwila i zacznie tłumaczyć reszcie ligi strategię, jakby nie podejmował wcześniej decyzji godnych człowieka rzucającego monetą.`
    });
    const faller=[...details].filter(x=>x.rank>x.lastRank).sort((a,b)=>(b.rank-b.lastRank)-(a.rank-a.lastRank))[0];
    if(faller) add(60+(faller.rank-faller.lastRank)*8,{
      tag:"📉 TITANIC AWARD",
      title:`${faller.team} leci w dół. Orkiestra może już zacząć grać`,
      body:`${faller.manager} spadł z ${faller.lastRank}. na ${faller.rank}. miejsce. ${faller.gwPoints} pkt nie wystarczyło, żeby zatkać dziurę w kadłubie. Jeżeli tak dalej pójdzie, następny raport będziemy pisać z dna tabeli.`
    });

    // Luck / bad luck proxies based on bench and captain outcomes.
    const unlucky=[...details].sort((a,b)=>(b.benchPoints + (b.best?.rawPoints||0))-(a.benchPoints + (a.best?.rawPoints||0)))[0];
    if(unlucky?.benchPoints>=5) add(50+unlucky.benchPoints*2,{
      tag:"😭 NAJWIĘKSZY PECHOWIEC",
      title:`${unlucky.team} miało punkty. Oczywiście tam, gdzie nic z nich nie ma`,
      body:`${unlucky.manager} zostawił ${unlucky.benchPoints} pkt na ławce. Można mówić o pechu, ale po pewnym poziomie pecha zaczynamy już mówić o spierdolonym ustawieniu składu. FPL nie zna litości i tym razem też jej nie pokaże.`
    });

    const lucky=[...details].filter(x=>x.gwPoints>0).sort((a,b)=>{
      const ar=(a.best?.rawPoints||0)/a.gwPoints, br=(b.best?.rawPoints||0)/b.gwPoints;
      return br-ar;
    })[0];
    if(lucky?.best) add(42+((lucky.best.rawPoints/lucky.gwPoints)*50),{
      tag:"🍀 FARCIARZ JEBANY",
      title:`${lucky.team} żyje dzięki ${lucky.best.name}. Strategia czy zwykły fart?`,
      body:`${lucky.best.name} z ${lucky.best.club} zrobił ${lucky.best.rawPoints} pkt i uratował ${lucky.manager} sporą część kolejki. Reszta składu może mu postawić piwo, bo bez niego narracja w tej gazecie byłaby znacznie mniej przyjemna.`
    });

    // Derby: closest GW scores.
    let derby=null;
    for(let i=0;i<details.length;i++) for(let j=i+1;j<details.length;j++){
      const gap=Math.abs(details[i].gwPoints-details[j].gwPoints);
      if(!derby||gap<derby.gap) derby={a:details[i],b:details[j],gap};
    }
    if(derby) add(45+Math.max(0,10-derby.gap)*3,{
      tag:"⚔️ DERBY FPLOWEJ",
      title:`${derby.a.team} kontra ${derby.b.team}: ${derby.a.gwPoints}:${derby.b.gwPoints} w wojnie o absolutnie wszystko`,
      body:`${derby.a.manager} i ${derby.b.manager} dzieli tylko ${derby.gap} pkt w tej kolejce. Jeden transfer, jeden bonus albo jeden głupi żółty kartonik może zdecydować, kto będzie się wymądrzał do następnego deadline'u, a kto będzie musiał czytać o sobie tutaj.`
    });

    // Prosecution: pick the strongest failure story.
    const crimes=[];
    if(tf) crimes.push({score:(tf.outPoints-tf.inPoints)*5, text:`sprzedaż ${tf.outName} przed jego ${tf.outPoints}-punktowym wynikiem` , owner:tf.owner});
    if(benchKing?.benchPoints) crimes.push({score:benchKing.benchPoints*3,text:`zostawienie ${benchKing.benchPoints} pkt na ławce`,owner:benchKing});
    if(hitKing?.transferCost) crimes.push({score:hitKing.transferCost*5,text:`oddanie ${hitKing.transferCost} pkt za transfery`,owner:hitKing});
    if(capFail?.captainHasPlayed) crimes.push({score:Math.max(1,12-capFail.captain.points)*4,text:`kapitan ${capFail.captain.name} z wynikiem ${capFail.captain.points} pkt po mnożniku`,owner:capFail});
    crimes.sort((a,b)=>b.score-a.score);
    if(crimes[0]) add(110+crimes[0].score,{
      tag:"🚨 PROKURATURA FPL",
      title:`Wszczęto śledztwo przeciwko ${crimes[0].owner.team}`,
      body:`Zarzut: ${crimes[0].text}. Redakcja przeanalizowała materiał dowodowy i nie znalazła żadnych okoliczności łagodzących. ${crimes[0].owner.manager} ma prawo zachować milczenie i powinien z niego, kurwa, skorzystać, bo próba tłumaczenia tego gówna może być jeszcze bardziej kompromitująca niż sama decyzja. ${variants(ownerRoasts,15)}`
    });

    // Power ranking proxy: current overall table + GW form.
    const power=[...details].sort((a,b)=>(a.rank-b.rank)|| (b.gwPoints-a.gwPoints))[0];
    if(power) add(48,{
      tag:"👑 POWER RANKING",
      title:`${power.team} siedzi na szczycie. Na razie to reszta ma problem`,
      body:`${power.manager} jest ${power.rank}. w tabeli z ${power.overall} pkt overall i ${power.gwPoints} pkt w obecnej GW. Czy to dominacja, czy tylko chwilowy układ planet? Redakcja nie wie, ale dopóki jest pierwszy, może bezkarnie obrażać wszystkich poniżej.`
    });

    // "Hospital" only if FPL availability flags actually indicate unavailable/doubtful players.
    const hospitals=details.map(x=>{
      const bad=x.squad.filter(sp=>{
        const original=Object.values(players).find(p=>p.web_name===sp.name);
        return original && (original.status==="i"||original.status==="s"||original.status==="u"||Number(original.chance_of_playing_next_round||100)<75);
      });
      return {owner:x,bad};
    }).sort((a,b)=>b.bad.length-a.bad.length);
    if(hospitals[0]?.bad.length) add(50+hospitals[0].bad.length*10,{
      tag:"🏥 SZPITAL POLOWY",
      title:`${hospitals[0].owner.team} wygląda bardziej jak izba przyjęć niż skład FPL`,
      body:`${hospitals[0].owner.manager} trzyma w kadrze ${hospitals[0].bad.length} zawodników oznaczonych przez FPL jako kontuzjowani, zawieszeni, niedostępni albo wątpliwi: ${hospitals[0].bad.map(p=>p.name).join(", ")}. Jeśli planem było sprawdzenie głębokości ławki, eksperyment idzie znakomicie.`
    });

    // Publish only 10 most relevant, avoid duplicate categories and excessive focus on one manager.
    candidates.sort((a,b)=>b.score-a.score);
    const finalArticles=[];
    const tags=new Set();
    const managerCounts={};
    for(const a of candidates){
      if(finalArticles.length>=10) break;
      if(tags.has(a.tag)) continue;
      tags.add(a.tag);
      finalArticles.push({tag:a.tag,title:a.title,body:a.body});
    }

    return NextResponse.json({
      ok:true, league:{id:LEAGUE_ID,name:league.league.name}, gw,
      updatedAt:new Date().toISOString(),
      gwFinished,
      teamScoreSource:"league.standings.event_total",
      overallSource:"league.standings.total",
      pointsSource:`/event/${gw}/live/`,
      fixtureSource:`/fixtures/?event=${gw}`,
      standings:details,
      articles:finalArticles
    }, {headers:{"Cache-Control":"no-store, no-cache, must-revalidate, max-age=0"}});
  } catch(e) {
    return NextResponse.json({ok:false,error:String(e?.message||e)}, {status:500});
  }
}
