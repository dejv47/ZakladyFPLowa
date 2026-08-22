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
        history: (() => {
          const rows = (hist?.current || []).map(z => ({
            gw: Number(z.event),
            points: Number(z.points || 0),
            total: Number(z.total_points || 0),
            rank: Number(z.rank || 0),
            overallRank: Number(z.overall_rank || 0),
            bench: Number(z.points_on_bench || 0),
            transfers: Number(z.event_transfers || 0),
            cost: Number(z.event_transfers_cost || 0)
          }));

          const currentIndex = rows.findIndex(z => z.gw === Number(gw));
          const canonicalCurrent = {
            gw: Number(gw),
            points: Number(row.event_total ?? picks?.entry_history?.points ?? 0),
            total: Number(row.total ?? picks?.entry_history?.total_points ?? 0),
            rank: Number(picks?.entry_history?.rank ?? 0),
            overallRank: Number(picks?.entry_history?.overall_rank ?? 0),
            bench: Number(picks?.entry_history?.points_on_bench ?? h?.points_on_bench ?? 0),
            transfers: Number(picks?.entry_history?.event_transfers ?? h?.event_transfers ?? 0),
            cost: Number(picks?.entry_history?.event_transfers_cost ?? h?.event_transfers_cost ?? 0)
          };

          if (currentIndex >= 0) rows[currentIndex] = canonicalCurrent;
          else rows.push(canonicalCurrent);

          return rows.sort((a,b) => a.gw - b.gw);
        })(),
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

    // Team-name-aware roast engine. It deliberately keys off fantasy team names
    // and adds extra jokes without changing any scoring data.
    const normalizeName = (s="") =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const teamNameRoasts = (teamName, salt=0) => {
      const n = normalizeName(teamName);
      const pools = [];

      if (n.includes("man ciot")) pools.push(
        "Nazwa „Man Cioty” zobowiązuje i zespół robi wszystko, żeby reputacji nie zepsuć.",
        "Man Cioty ponownie udowadniają, że człon „Man” w nazwie jest bardziej aspiracją niż opisem projektu sportowego.",
        "W Man Ciotach atmosfera podobno świetna — wynik chujowy, ale przynajmniej branding się zgadza.",
        "Kibice Man Ciot domagają się charakteru. Zarząd odpowiedział, że sama nazwa powinna wystarczyć.",
        "Man Cioty weszły w tę kolejkę z rozmachem i wyszły z niej jak zwykle: z memem zamiast planu."
      );
      if (n.includes("ciot")) pools.push(
        "Drużyna z „ciotami” w nazwie znów dostarczyła redakcji materiału szybciej niż zawodnicy punktów.",
        "Nazwa miała być żartem, ale wyniki zaczynają ją traktować jak instrukcję obsługi."
      );
      if (n.includes("city") || n.includes("man c")) pools.push(
        "City w nazwie, a zarządzanie bardziej jak w klubie z niedzielnej ligi po sobotnim weselu.",
        "Ambicje jak Manchester City, wykonanie jak Manchester Shitty."
      );
      if (n.includes("united") || n.includes("manu") || n.includes("man u")) pools.push(
        "„United” jest tu chyba tylko w nazwie, bo punkty i zdrowy rozsądek dawno się rozeszły.",
        "Manchesterowe aspiracje są, tylko wynik wygląda jak kolejny kryzys na Old Trafford."
      );
      if (n.includes("liver") || n.includes("pool")) pools.push(
        "Liverpool w nazwie, ale pressing wykonuje głównie właściciel na przycisku odświeżania tabeli.",
        "You'll Never Walk Alone, chyba że chodzi o marsz w dół tabeli — wtedy drużyna radzi sobie sama."
      );
      if (n.includes("arsenal") || n.includes("gunner")) pools.push(
        "Arsenalowe inspiracje pełną gębą: dużo nadziei, dużo analiz i potencjał do spektakularnego wkurwienia.",
        "Kanonierzy? Na razie bardziej kapiszony — huk jest, punktów mniej."
      );
      if (n.includes("tottenham") || n.includes("spurs") || n.includes("totki")) pools.push(
        "Tottenham w nazwie, więc cierpienie właściciela było najwyraźniej wpisane w statut klubu.",
        "Spurs DNA działa bez zarzutu: kiedy pojawia się nadzieja, zaraz ktoś ją efektownie rozpierdala."
      );
      if (n.includes("chelsea")) pools.push(
        "Chelsea-style squad building: dużo nazwisk, dużo pomysłów i ani jednego człowieka pewnego, po co to wszystko.",
        "Projekt wygląda jak okno transferowe Chelsea — ruchu od cholery, sensu trzeba szukać z lupą."
      );
      if (n.includes("villa")) pools.push(
        "Villa w nazwie brzmi elegancko, ale w środku tej posiadłości ktoś właśnie nasrał na dywan.",
        "Aston Villa vibes: ambicje europejskie, a menedżer FPL chwilami zarządza jak woźny po godzinach."
      );
      if (n.includes("real")) pools.push(
        "„Real” w nazwie jest odważne, bo realny jest tu głównie ból po sprawdzeniu punktów.",
        "Galácticos w nazwie, galaktyczna jest na razie skala odklejenia właściciela."
      );
      if (n.includes("fc")) pools.push(
        "Dumny dopisek FC sugeruje profesjonalizm. Wynik sugeruje, że to skrót od „Fucking Catastrophe”.",
        "FC brzmi poważnie, dopóki człowiek nie zobaczy, co właściciel odpierdolił ze składem."
      );

      const generic = [
        `Nazwa „${teamName}” brzmi jak klub z ambicjami. Szkoda, że decyzje kadrowe brzmią jak wołanie o pomoc.`,
        `${teamName} ma własny herb, nazwę i menedżera. Z tych trzech rzeczy najbardziej podejrzany jest menedżer.`,
        `Dział PR ${teamName} prosi, żeby nie łączyć nazwy klubu z tym, co właśnie wydarzyło się na boisku.`,
        `${teamName} ponownie pokazuje, że kreatywna nazwa drużyny nie daje żadnych punktów za kreatywne spierdalanie kolejki.`,
        `W siedzibie ${teamName} trwa analiza. Pierwszy wniosek: „kto, kurwa, zatwierdził ten skład?”.`,
        `${teamName} wygląda jak projekt, który na prezentacji miał ładne slajdy, a potem ktoś zapomniał zatrudnić ludzi kompetentnych.`,
        `Kibice ${teamName} zasługują na wyjaśnienia. Niestety właściciel sam ich potrzebuje.`,
        `${teamName}: nazwa premium, zarządzanie w wersji trial.`,
        `Skauci ${teamName} podobno pracowali całą noc. Efekty wskazują, że grali wtedy w Counter-Strike'a.`,
        `${teamName} nie jest dziś drużyną. To bardziej eksperyment społeczny sprawdzający, ile cierpienia wytrzyma jeden właściciel konta FPL.`
      ];

      const all = [...pools, ...generic];
      return all[(gw * 7 + salt * 11 + teamName.length) % all.length];
    };

    const extraPunch = (owner, salt=0) => {
      const lines = [
        `${teamNameRoasts(owner.team, salt)} ${variants(ownerRoasts, salt+20)}`,
        `${variants(ownerRoasts, salt+21)} ${teamNameRoasts(owner.team, salt+1)}`,
        `${teamNameRoasts(owner.team, salt+2)} Redakcja zaleca nie podejmować kolejnych decyzji bez nadzoru osoby trzeźwej.`,
        `${teamNameRoasts(owner.team, salt+3)} Na konferencji prasowej zabrakło pytań, bo wszyscy tylko patrzyli z niedowierzaniem.`,
        `${teamNameRoasts(owner.team, salt+4)} Komisja ligi rozważa wprowadzenie testu na inteligencję przed przyciskiem „Save My Team”.`,
        `${teamNameRoasts(owner.team, salt+5)} Bukmacherzy przestali przyjmować zakłady na kolejną głupią decyzję — kurs spadł do 1.01.`
      ];
      return lines[(gw + salt + owner.team.length) % lines.length];
    };

    const sorted = [...details].sort((a,b)=>b.gwPoints-a.gwPoints);
    const bestGW = sorted[0];
    const worstGW = sorted.at(-1);
    const benchKing = [...details].sort((a,b)=>b.benchPoints-a.benchPoints)[0];
    const hitKing = [...details].sort((a,b)=>b.transferCost-a.transferCost)[0];

    if (bestGW) add(90 + bestGW.gwPoints, {
      tag:"👑 KRÓL TEGO BURDELU",
      title:`${bestGW.team} rozjebało konkurencję. Rywale już produkują wymówki`,
      body:`${bestGW.manager} ma ${bestGW.gwPoints} pkt ${finishWord}. ${bestGW.best ? `${bestGW.best.name} (${bestGW.best.club}) dołożył ${bestGW.best.rawPoints} pkt i zrobił za pół składu robotę.` : ""} ${bestGW.captain ? (bestGW.captainHasPlayed ? `Kapitan ${bestGW.captain.name} dowiózł ${bestGW.captain.points} pkt po mnożniku.` : `Kapitan ${bestGW.captain.name} jeszcze nie grał, więc ten burdel może być jeszcze większy.`) : ""} Menedżer chodzi teraz jak Guardiola po mistrzostwie, choć tydzień temu prawdopodobnie sam nie wiedział, po co ma połowę tych piłkarzy. ${extraPunch(bestGW,31)}`
    });

    if (worstGW) add(100 + Math.max(0, bestGW.gwPoints-worstGW.gwPoints), {
      tag:"💩 KOMPROMITACJA KOLEJKI",
      title:`${worstGW.team}: ktoś powinien odebrać temu człowiekowi hasło do FPL`,
      body:`${worstGW.manager} ma ${worstGW.gwPoints} pkt, czyli najmniej w lidze. ${variants(scoreRoasts,1)}. ${worstGW.benchPoints ? `Na ławce kisi się ${worstGW.benchPoints} pkt, więc nawet rezerwowi patrzą na trenera jak na idiotę.` : ""} Zarząd milczy. Trudno się dziwić — co tu kurwa komentować. ${extraPunch(worstGW,32)}`
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
      body:`${capFail.manager} dał opaskę ${capFail.captain.name} (${capFail.captain.club}), który po mnożniku dał ${capFail.captain.points} pkt. ${variants(captainRoasts,3)}. ${capFail.best&&capFail.best.name!==capFail.captain.name ? `Tymczasem ${capFail.best.name} zrobił ${capFail.best.rawPoints} pkt bez tej zaszczytnej literki C.` : ""} ${extraPunch(capFail,35)}`
    });

    // Frajer kolejki / transfer z dupy: sold player outscored the replacement.
    const transferFails = details.flatMap(x => (x.gwTransfers||[]).map(t=>({owner:x,...t})))
      .filter(t=>t.inPlayed && t.outPlayed && t.outPoints > t.inPoints)
      .sort((a,b)=>(b.outPoints-b.inPoints)-(a.outPoints-a.inPoints));
    const tf = transferFails[0];
    if (tf) add(85 + (tf.outPoints-tf.inPoints)*5, {
      tag:"🤡 FRAJER KOLEJKI",
      title:`${tf.owner.team} wyrzuca ${tf.outName}, a ten odpowiada ${tf.outPoints} punktami`,
      body:`${tf.owner.manager} sprzedał ${tf.outName} (${tf.outClub}) i kupił ${tf.inName} (${tf.inClub}). Nowy nabytek zrobił ${tf.inPoints} pkt, stary ${tf.outPoints}. Różnica: ${tf.outPoints-tf.inPoints} pkt prosto w mordę. Rynek transferowy właśnie wystawił rachunek za bycie mądrzejszym od wszystkich. ${extraPunch(tf.owner,36)}`
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
      body:`${faller.manager} spadł z ${faller.lastRank}. na ${faller.rank}. miejsce. ${faller.gwPoints} pkt nie wystarczyło, żeby zatkać dziurę w kadłubie. Jeżeli tak dalej pójdzie, następny raport będziemy pisać z dna tabeli. ${extraPunch(faller,37)}`
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
      body:`Zarzut: ${crimes[0].text}. Redakcja przeanalizowała materiał dowodowy i nie znalazła żadnych okoliczności łagodzących. ${crimes[0].owner.manager} ma prawo zachować milczenie i powinien z niego, kurwa, skorzystać, bo próba tłumaczenia tego gówna może być jeszcze bardziej kompromitująca niż sama decyzja. ${extraPunch(crimes[0].owner,38)}`
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

    // ---------- FPLowa MEGA analytics v22 ----------
    const canonicalHistoryFor = (x) => {
      const hs = [...(x.history || [])];
      const idx = hs.findIndex(h => Number(h.gw) === Number(gw));
      const current = {
        gw:Number(gw),
        points:Number(x.gwPoints || 0),
        total:Number(x.overall || 0),
        rank:0,
        overallRank:0,
        bench:Number(x.benchPoints || 0),
        transfers:Number(x.transfers || 0),
        cost:Number(x.transferCost || 0)
      };
      if (idx >= 0) hs[idx] = {...hs[idx], ...current};
      else hs.push(current);
      return hs.sort((a,b)=>a.gw-b.gw);
    };

    const profileComment = (x, stats) => {
      const {avg3, benchSeason, hitSeason, bestGW, worstGW, editorial} = stats;
      const hs = canonicalHistoryFor(x);
      const finishedHs = hs.filter(h => h.gw < gw || gwFinished);
      const last3 = finishedHs.slice(-3);
      const trend = last3.length >= 3 ? last3[2].points - last3[0].points : 0;
      const spread = bestGW && worstGW ? bestGW.points - worstGW.points : 0;

      // deterministic but highly varied: manager + team + GW + salt
      const pick = (arr, salt=0) =>
        arr[(Number(gw)*101 + Number(x.entry)*37 + x.team.length*13 + salt*17) % arr.length];

      const openers = editorial >= 8 ? [
        `${x.manager} wygląda, jakby faktycznie czytał zasady tej gry zamiast klikać ludzi po kolorze koszulki.`,
        `${x.manager} na razie prowadzi drużynę z irytującą kompetencją.`,
        `${x.manager} robi rzeczy poprawnie tak często, że zaczyna to być podejrzane.`,
        `${x.manager} zachowuje się jak człowiek z planem, a najgorsze jest to, że tabela ten plan potwierdza.`,
        `${x.manager} jest dziś tym typem, którego wszyscy chcieliby wyśmiać, ale wyniki niestety nie pozwalają.`,
        `${x.manager} ma formę człowieka, który po deadline'ie nie musi sprawdzać Twittera z drżącą ręką.`,
        `${x.manager} wygląda jak ktoś, kto przypadkiem zatrudnił kompetentny sztab.`,
        `${x.manager} jest jednym z nielicznych, przy których redakcja musi używać słowa „dobrze” bez ironii.`,
        `${x.manager} zarządza tym projektem tak, jakby miał dostęp do wersji FPL bez głupich decyzji.`,
        `${x.manager} na razie daje mniej contentu do roastu niż rywale, co samo w sobie jest sukcesem.`
      ] : editorial >= 6.5 ? [
        `${x.manager} trzyma solidny poziom i unika większych pożarów.`,
        `${x.manager} robi wystarczająco dużo dobrze, żeby nie stać się stałym klientem Prokuratury FPL.`,
        `${x.manager} nie błyszczy bez przerwy, ale też nie podpala sobie rankingu co weekend.`,
        `${x.manager} wygląda rozsądnie, choć w tej grze rozsądek ma termin ważności do następnego deadline'u.`,
        `${x.manager} jest w dobrej strefie: może się wymądrzać, ale jeszcze nie powinien drukować autobiografii.`,
        `${x.manager} prowadzi drużynę bez większego chaosu, co w tej lidze jest niemal ekstrawagancją.`,
        `${x.manager} ma sezon na plus i nie wygląda, jakby każda kolejka była nowym eksperymentem.`,
        `${x.manager} spokojnie zbiera punkty i chwilowo nie daje powodów do odebrania mu klawiatury.`,
        `${x.manager} utrzymuje się po właściwej stronie granicy między planem a przypadkiem.`,
        `${x.manager} robi swoje i czeka, aż inni sami się wywrócą. Strategia prosta, ale skuteczna.`
      ] : editorial >= 5 ? [
        `${x.manager} siedzi dokładnie w środku strefy „mogło być gorzej, mogło być lepiej”.`,
        `${x.manager} prezentuje profesjonalną przeciętność.`,
        `${x.manager} prowadzi sezon jak człowiek jadący 90 na tempomacie po pustej autostradzie.`,
        `${x.manager} nie jest jeszcze bohaterem, ale też nie wymaga interwencji komisji.`,
        `${x.manager} balansuje między „mam plan” a „zobaczymy co się stanie”.`,
        `${x.manager} jest wystarczająco dobry, żeby żyć, i wystarczająco słaby, żeby redakcja miała materiał.`,
        `${x.manager} ma sezon w kolorze beżowym: nic nie eksploduje, nic nie zachwyca.`,
        `${x.manager} utrzymuje się na powierzchni dzięki mieszance rozsądku i cudzych błędów.`,
        `${x.manager} jest definicją ligowego środka — ani szampan, ani nekrolog.`,
        `${x.manager} robi tyle, żeby nie było wstydu, ale za mało, żeby ktoś robił screeny z jego składu.`
      ] : editorial >= 3.5 ? [
        `${x.manager} konsekwentnie flirtuje z katastrofą.`,
        `${x.manager} podejmuje wystarczająco dużo złych decyzji, żeby mówić już o stylu.`,
        `${x.manager} prowadzi ten projekt jak człowiek, który dostał połowę instrukcji.`,
        `${x.manager} jest na etapie, gdzie auto-pick zaczyna wyglądać jak konsultant.`,
        `${x.manager} zmierza w złą stronę z imponującą konsekwencją.`,
        `${x.manager} ma więcej czerwonych flag niż sensownych argumentów.`,
        `${x.manager} regularnie mówi sobie „tym razem będzie inaczej” i regularnie dostaje odpowiedź od FPL.`,
        `${x.manager} wygląda jak trener po trzeciej konferencji z rzędu zaczynającej się od „musimy wyciągnąć wnioski”.`,
        `${x.manager} zaczyna zamieniać pecha w powtarzalny proces.`,
        `${x.manager} ma drużynę, która bardziej przypomina listę problemów niż projekt sportowy.`
      ] : [
        `${x.manager} prowadzi sezon jak zgłoszenie do Hall of Shame.`,
        `${x.manager} nie tyle zarządza drużyną, co kataloguje katastrofy.`,
        `${x.manager} wygląda, jakby ktoś mu powiedział, że najniższy wynik wygrywa.`,
        `${x.manager} stworzył projekt, który powinien mieć ostrzeżenie „nie próbujcie tego w domu”.`,
        `${x.manager} jest już tak głęboko w gównie, że zaczyna urządzać tam salon.`,
        `${x.manager} zbudował sobie prywatny escape room bez wyjścia.`,
        `${x.manager} udowadnia, że pełna informacja nie chroni przed głupimi decyzjami.`,
        `${x.manager} ma sezon, od którego własne punkty próbują się odciąć.`,
        `${x.manager} prowadzi ekipę jak człowiek testujący wytrzymałość psychiczną samego siebie.`,
        `${x.manager} zrobił z FPL eksperyment społeczny, tylko nikt nie podpisał zgody.`
      ];

      const formLines = avg3 >= 70 ? [
        `Ostatnie trzy GW to ${avg3.toFixed(1)} średnio. Rywale mogą już składać oficjalne skargi.`,
        `Forma z 3 GW wynosi ${avg3.toFixed(1)}. To jest regularne wpierdalanie punktów reszcie ligi.`,
        `${avg3.toFixed(1)} średnio z trzech. Na tym etapie farta trzeba już nazywać formą.`,
        `Trzy ostatnie kolejki dają średnio ${avg3.toFixed(1)}. Redakcja nie lubi tego przyznawać, ale wygląda to legitnie.`,
        `Forma 3 GW: ${avg3.toFixed(1)}. Ktoś tu najwyraźniej znalazł przycisk „dobry wynik”.`,
        `${avg3.toFixed(1)} z ostatnich trzech GW to tempo, które zaczyna wkurwiać otoczenie.`
      ] : avg3 >= 55 ? [
        `Średnia 3 GW to ${avg3.toFixed(1)}. Stabilnie i bez większego burdelu.`,
        `${avg3.toFixed(1)} z trzech ostatnich kolejek. Nie ma fajerwerków, ale straż pożarna też nie jest potrzebna.`,
        `Forma trzyma ${avg3.toFixed(1)} średnio. Można udawać, że wszystko było zaplanowane.`,
        `Ostatnie trzy GW: ${avg3.toFixed(1)}. Przyzwoicie, czyli nudno dla redakcji.`,
        `${avg3.toFixed(1)} średnio. Taki wynik nie daje memów, ale daje spokój.`,
        `Forma jest zdrowa: ${avg3.toFixed(1)} średnio z trzech.`
      ] : avg3 <= 30 ? [
        `Ostatnie trzy GW to ${avg3.toFixed(1)} średnio. To już nie kryzys, to abonament.`,
        `${avg3.toFixed(1)} z trzech ostatnich kolejek. Ranking cierpi, menedżer prawdopodobnie też.`,
        `Forma 3 GW: ${avg3.toFixed(1)}. Słowo „słabo” zaczyna być zbyt delikatne.`,
        `Ostatnie trzy kolejki dają ${avg3.toFixed(1)} średnio. To kontrolowane nurkowanie bez butli.`,
        `${avg3.toFixed(1)} średnio. FPL wysłało już zaproszenie do programu pomocowego.`,
        `Forma z trzech GW to ${avg3.toFixed(1)}. Tu już nie trzeba analiz, tylko egzorcyzmu.`
      ] : [
        `Ostatnie trzy GW: ${avg3.toFixed(1)} średnio. Żyje, ale aparatura pika.`,
        `Forma 3 GW to ${avg3.toFixed(1)}. Za mało na dumę, za dużo na nekrolog.`,
        `${avg3.toFixed(1)} średnio. Sporo miejsca na poprawę i jeszcze więcej na kolejne błędy.`,
        `Ostatnie trzy kolejki wyglądają na ${avg3.toFixed(1)} średnio — klasyczne „musimy pracować dalej”.`,
        `Forma wynosi ${avg3.toFixed(1)}. Ani tragedia, ani coś, czym człowiek się chwali.`,
        `${avg3.toFixed(1)} średnio z trzech. Taki wynik istnieje głównie po to, żeby denerwować właściciela.`
      ];

      const benchLines = benchSeason >= 70 ? [
        `Ławka zebrała już ${benchSeason} pkt. To jest druga drużyna, która regularnie wygląda lepiej od pierwszej.`,
        `${benchSeason} pkt na ławce. Rezerwowi powinni mieć własnego menedżera.`,
        `Na rezerwie zmarnowano ${benchSeason} pkt. To już infrastruktura do cierpienia.`,
        `${benchSeason} pkt poza XI. Gdyby za marnowanie punktów dawali medale, byłoby podium.`,
        `Ławka ma ${benchSeason} pkt. To nie przypadek, tylko alternatywna rzeczywistość, w której skład jest dobry.`,
        `${benchSeason} pkt na ławce to dowód, że talent w drużynie istnieje. Problem siedzi wyżej.`
      ] : benchSeason >= 35 ? [
        `Na ławce zostało ${benchSeason} pkt. Jeszcze nie tragedia narodowa, ale już lokalny skandal.`,
        `${benchSeason} pkt rezerwowych. Kilka razy można mówić o pechu, potem zaczyna się rozmowa o kompetencjach.`,
        `Ławka ma ${benchSeason} pkt. Część z nich pewnie wraca do menedżera w snach.`,
        `${benchSeason} pkt poza składem. Wystarczająco, żeby bolało.`,
        `Rezerwa kosztowała ${benchSeason} pkt. Nie jest dobrze, ale jest content.`,
        `${benchSeason} pkt na ławce — wynik wystarczający do kilku porządnych „kurwa”.`
      ] : [
        `Ławka kosztowała tylko ${benchSeason} pkt. Albo dobre decyzje, albo słabi rezerwowi.`,
        `Na rezerwie zostało ${benchSeason} pkt. Przynajmniej tutaj nie ma wielkiego przestępstwa.`,
        `${benchSeason} pkt na ławce. Czysto, schludnie, podejrzanie rozsądnie.`,
        `Ławka: ${benchSeason} pkt. Redakcja nie ma dziś podstaw do aktu oskarżenia.`,
        `Tylko ${benchSeason} pkt poza XI. Ktoś najwyraźniej umie czytać fixtures.`,
        `Rezerwa nie robi większych szkód: ${benchSeason} pkt.`
      ];

      const hitLines = hitSeason >= 24 ? [
        `Na hity poszło ${hitSeason} pkt. To już nie transfery, tylko subskrypcja na minusy.`,
        `${hitSeason} pkt wydane za dodatkowe ruchy. Dział sportowy działa jak hazardzista.`,
        `Koszt hitów: -${hitSeason}. Rywale dziękują za dotacje.`,
        `${hitSeason} pkt oddane za transfery. To jest podatek od własnej niecierpliwości.`,
        `Hity zabrały ${hitSeason} pkt. W normalnym klubie ktoś już oddawałby kartę wejściową.`,
        `Transferowe minusy: ${hitSeason}. Księgowość odmówiła komentarza.`
      ] : hitSeason >= 8 ? [
        `Hity kosztowały ${hitSeason} pkt. Jeszcze da się bronić, ale teczka już istnieje.`,
        `${hitSeason} pkt wydane na dodatkowe ruchy. Hazard kontrolowany, ale hazard.`,
        `Koszt hitów: ${hitSeason}. Czasem warto, czasem człowiek płaci za własny błąd dwa razy.`,
        `${hitSeason} pkt poszło na transfery. Redakcja obserwuje rachunek.`,
        `Hity zabrały ${hitSeason} pkt. Nie dramat, ale każdy minus ma smak porażki.`,
        `Transferowe -${hitSeason}. Jeszcze nie kryminał, bardziej wykroczenie.`
      ] : [
        `Hity kosztowały tylko ${hitSeason} pkt. Dyscyplina albo strach przed transferami.`,
        `${hitSeason} pkt na minusie za transfery. Rozsądnie jak na tę ligę.`,
        `Koszt hitów: ${hitSeason}. Przynajmniej nie rozdaje punktów hurtowo.`,
        `Transferowe minusy są małe: ${hitSeason}. Dział księgowy chwilowo spokojny.`,
        `Hity: ${hitSeason}. Menedżer nie robi z deadline'u kasyna.`,
        `Tylko ${hitSeason} pkt kosztów transferowych. Dziwnie odpowiedzialnie.`
      ];

      const trendLines = trend >= 20 ? [
        `Trend rośnie o ${trend} pkt. Ktoś tu chyba ogarnął, gdzie był problem.`,
        `+${trend} pkt między skrajnymi GW z ostatnich trzech. Kryzys się cofa.`,
        `Forma idzie w górę: +${trend}. Redakcja odkłada nekrolog.`,
        `Trend +${trend}. To już wygląda jak odbicie, nie przypadek.`,
        `Ostatnie kolejki pokazują +${trend}. Wreszcie coś działa.`,
        `Kierunek: w górę o ${trend} pkt. Rzadki widok.`
      ] : trend <= -20 ? [
        `Trend leci o ${Math.abs(trend)} pkt w dół. Winda zerwała linę.`,
        `Spadek formy: ${Math.abs(trend)} pkt. Ktoś powinien sprawdzić panel sterowania.`,
        `${trend} pkt trendu. To nie korekta, to zjazd.`,
        `Forma spada o ${Math.abs(trend)}. Właściciel ma pełne prawo panikować.`,
        `Trend ${trend}. Rywale oglądają z popcornem.`,
        `Ostatnie GW zabierają ${Math.abs(trend)} pkt jakości. Niepokojąco konsekwentnie.`
      ] : [
        `Trend jest płaski. Ani rakieta, ani katastrofa.`,
        `Forma nie robi gwałtownych ruchów. Nuda, ale bezpieczna.`,
        `Trend nie krzyczy ani „geniusz”, ani „ratunku”.`,
        `Ostatnie wyniki są stabilne. Redakcja ziewa, menedżer może spać.`,
        `Brak wielkiego trendu. Wszystko stoi, czyli przynajmniej nie spada.`,
        `Krzywa formy jest spokojna. Na razie.`
      ];

      const rankLines = x.rank === 1 ? [
        `Jest liderem ligi, więc każdy głupi ruch może być teraz sprzedany jako „odważna strategia”.`,
        `Pierwsze miejsce daje pełne prawo do bycia nieznośnym.`,
        `Siedzi na szczycie i może udawać, że wszystko było częścią wizji.`,
        `Lider tabeli. Dopóki nim jest, roast boli trochę mniej.`,
        `Numer jeden. Reszta może tylko szukać haka.`,
        `Pierwszy w lidze — najwyższy punkt do ewentualnego spektakularnego upadku.`
      ] : x.rank === details.length ? [
        `Jest ostatni. Tabela nie sugeruje problemu, tylko go drukuje.`,
        `Zamyka stawkę. Przynajmniej nie musi patrzeć, kto jest za nim.`,
        `Ostatnie miejsce daje stabilność, której nie daje nic innego.`,
        `Jest na dnie i pełni funkcję punktu odniesienia dla reszty.`,
        `Kończy tabelę. Każdy ruch w górę będzie teraz sukcesem.`,
        `Ostatni. Nawet scrollowanie tabeli jest krótkie.`
      ] : x.rank <= 3 ? [
        `Top 3 pozwala na lekkie kozaczenie.`,
        `Czołówka ligi. Teraz trzeba tylko tego nie spierdolić.`,
        `Miejsce ${x.rank}. wygląda dobrze. Historia zna jednak wielu bohaterów początku sezonu.`,
        `Jest wysoko i skutecznie unika Hall of Shame.`,
        `Top 3. Rywale patrzą, redakcja czeka na potknięcie.`,
        `Pozycja ${x.rank}. daje komfort i fałszywe poczucie bezpieczeństwa.`
      ] : [
        `Miejsce ${x.rank}. — jeszcze jest gdzie spaść i gdzie awansować.`,
        `Pozycja ${x.rank}. nie jest ani triumfem, ani katastrofą.`,
        `Siedzi na ${x.rank}. miejscu i obserwuje chaos z bezpiecznej odległości.`,
        `Ranking #${x.rank}. Wciąż wszystko można zepsuć.`,
        `Miejsce ${x.rank}. daje wystarczająco dużo nadziei, żeby bolało.`,
        `Jest ${x.rank}. — klasyczna pozycja do opowiadania, że sezon jest długi.`
      ];

      const ending = typeof teamNameRoasts === "function"
        ? teamNameRoasts(x.team, 90 + x.entry + gw)
        : pick([
            `${x.team} ma jeszcze czas, żeby udowodnić, że ten sezon nie jest przypadkiem.`,
            `Redakcja pozostaje w gotowości do kolejnego roastu ${x.team}.`,
            `${x.team} dostanie następną ocenę po kolejnej porcji decyzji.`,
            `Na razie werdykt jest taki: obserwujemy i nie ufamy.`,
            `Projekt trwa. Zdrowy rozsądek również, choć w ograniczonym zakresie.`,
            `Do następnego deadline'u wszystko może się zmienić. Zwłaszcza na gorsze.`
          ], 99);

      return [
        pick(openers,1),
        pick(formLines,2),
        pick(benchLines,3),
        pick(hitLines,4),
        pick(trendLines,5),
        pick(rankLines,6),
        ending
      ].join(" ");
    };

    const managerProfiles = details.map(x => {
      const allHs = canonicalHistoryFor(x);
      const hs = allHs.filter(h => h.gw < gw || gwFinished);
      const last3 = hs.slice(-3);
      const avg3 = last3.length ? last3.reduce((a,z)=>a+z.points,0)/last3.length : 0;
      const avg = hs.length ? hs.reduce((a,z)=>a+z.points,0)/hs.length : 0;
      const bestGW = hs.length ? [...hs].sort((a,b)=>b.points-a.points)[0] : null;
      const worstGW = hs.length ? [...hs].sort((a,b)=>a.points-b.points)[0] : null;
      const benchSeason = hs.reduce((a,z)=>a+Number(z.bench||0),0);
      const hitSeason = hs.reduce((a,z)=>a+Number(z.cost||0),0);

      const form = last3.map(z =>
        z.points >= 70 ? "🔥" :
        z.points >= 55 ? "👍" :
        z.points >= 40 ? "😐" : "💩"
      ).join("") || "—";

      // More stable editorial rating: rank + form + discipline.
      const rankComponent = details.length > 1
        ? ((details.length - x.rank) / (details.length - 1)) * 4
        : 2;
      const formComponent = Math.max(0, Math.min(4, (avg3 - 30) / 12));
      const disciplineComponent = Math.max(0, 2 - hitSeason/16 - benchSeason/120);
      const editorial = Math.max(1, Math.min(10, 1 + rankComponent + formComponent + disciplineComponent));

      const label =
        editorial >= 8 ? "ELITA" :
        editorial >= 6.5 ? "W FORMIE" :
        editorial >= 5 ? "JESZCZE ŻYJE" :
        editorial >= 3.5 ? "DO ZWOLNIENIA" : "TRUP";

      const stats = {
        avg:Number(avg.toFixed(1)),
        avg3:Number(avg3.toFixed(1)),
        bestGW, worstGW, benchSeason, hitSeason,
        editorial:Number(editorial.toFixed(1))
      };

      const icon =
        label === "ELITA" ? "👑" :
        label === "W FORMIE" ? "🔥" :
        label === "JESZCZE ŻYJE" ? "😐" :
        label === "DO ZWOLNIENIA" ? "🚨" : "💀";

      return {
        entry:x.entry, team:x.team, manager:x.manager, rank:x.rank, overall:x.overall,
        gwPoints:x.gwPoints, ...stats, form, label, icon,
        comment:profileComment(x, stats)
      };
    });

    const hallOfShame = [];

    for (const p of managerProfiles) {
      if (p.worstGW && p.worstGW.gw > 0) {
        hallOfShame.push({
          kind:"💀 Najgorszy wynik GW",
          value:`${p.worstGW.points} pkt (GW${p.worstGW.gw})`,
          manager:p.manager, team:p.team,
          score:Math.max(0, 100 - p.worstGW.points),
          raw:p.worstGW.points
        });
      }

      if (p.bestGW && p.bestGW.gw > 0) {
        hallOfShame.push({
          kind:"🎢 Największy rollercoaster",
          value:`${(p.bestGW.points - (p.worstGW?.points ?? p.bestGW.points))} pkt różnicy`,
          manager:p.manager, team:p.team,
          score:Math.max(0, p.bestGW.points - (p.worstGW?.points ?? p.bestGW.points)),
          raw:Math.max(0, p.bestGW.points - (p.worstGW?.points ?? p.bestGW.points))
        });
      }

      if (p.benchSeason > 0) {
        hallOfShame.push({
          kind:"🪑 Punkty na ławce",
          value:`${p.benchSeason} pkt`,
          manager:p.manager, team:p.team,
          score:p.benchSeason,
          raw:p.benchSeason
        });
      }

      if (p.hitSeason > 0) {
        hallOfShame.push({
          kind:"💸 Koszt hitów",
          value:`-${p.hitSeason} pkt`,
          manager:p.manager, team:p.team,
          score:p.hitSeason,
          raw:p.hitSeason
        });
      }

      if (p.avg3 > 0) {
        hallOfShame.push({
          kind:"🧊 Najzimniejsza forma 3 GW",
          value:`${p.avg3} pkt średnio`,
          manager:p.manager, team:p.team,
          score:Math.max(0, 100 - p.avg3),
          raw:p.avg3,
          lowerIsWorse:true
        });
      }

      if (p.editorial > 0) {
        hallOfShame.push({
          kind:"🏺 Najgorsza ocena redakcji",
          value:`${p.editorial}/10`,
          manager:p.manager, team:p.team,
          score:Math.max(0, 10 - p.editorial),
          raw:p.editorial,
          lowerIsWorse:true
        });
      }

      if (p.rank > 0) {
        hallOfShame.push({
          kind:"🕳️ Piwnica tabeli",
          value:`${p.rank}. miejsce`,
          manager:p.manager, team:p.team,
          score:p.rank,
          raw:p.rank
        });
      }
    }

    const hallKinds = [
      "💀 Najgorszy wynik GW",
      "🪑 Punkty na ławce",
      "💸 Koszt hitów",
      "🎢 Największy rollercoaster",
      "🧊 Najzimniejsza forma 3 GW",
      "🏺 Najgorsza ocena redakcji",
      "🕳️ Piwnica tabeli"
    ];

    const shameRecords = hallKinds.map(kind => {
      const candidates = hallOfShame.filter(x => x.kind === kind);
      if (!candidates.length) return null;

      if (kind === "🧊 Najzimniejsza forma 3 GW" || kind === "🏺 Najgorsza ocena redakcji") {
        return candidates.sort((a,b) => a.raw - b.raw)[0];
      }

      if (kind === "💀 Najgorszy wynik GW") {
        return candidates.sort((a,b) => a.raw - b.raw)[0];
      }

      return candidates.sort((a,b) => b.score - a.score)[0];
    }).filter(Boolean);

    const awards = [
      bestGW && {icon:"🏆",name:"Mózg GW",manager:bestGW.manager,team:bestGW.team,value:`${bestGW.gwPoints} pkt`},
      worstGW && {icon:"🤡",name:"Debil GW",manager:worstGW.manager,team:worstGW.team,value:`${worstGW.gwPoints} pkt`},
      benchKing?.benchPoints>0 && {icon:"🪑",name:"Ławkowy Guardiola",manager:benchKing.manager,team:benchKing.team,value:`${benchKing.benchPoints} pkt na ławce`},
      capFail && {icon:"©️",name:"Kapitan Debil",manager:capFail.manager,team:capFail.team,value:`${capFail.captain.name}: ${capFail.captain.points} pkt`},
      tf && {icon:"💸",name:"Transferowy Kryminalista",manager:tf.owner.manager,team:tf.owner.team,value:`-${tf.outPoints-tf.inPoints} pkt vs sprzedany`}
    ].filter(Boolean);

    const breakingNews = [];
    for (const x of details) {
      if (x.best?.rawPoints >= 8)
        breakingNews.push(`PILNE: ${x.best.name} (${x.best.club}) ma ${x.best.rawPoints} pkt dla ${x.manager}. W siedzibie ${x.team} chwilowo przestali przeklinać.`);
      if (x.captainHasPlayed && x.captain?.points <= 4)
        breakingNews.push(`ALARM: kapitan ${x.manager}, ${x.captain.name}, daje tylko ${x.captain.points} pkt po mnożniku. Pierwsze „kurwa” prawdopodobnie już padło.`);
      if (x.benchPoints >= 8)
        breakingNews.push(`SKANDAL: ${x.manager} kisi ${x.benchPoints} pkt na ławce. Ławka domaga się zmiany trenera.`);
    }

    const watchList = details.map(x => ({
      manager:x.manager, team:x.team,
      remaining:x.squad.filter(p=>p.position<=11&&!p.played).map(p=>p.name),
      active:x.squad.filter(p=>p.position<=11&&p.played&&!p.finished).map(p=>p.name)
    }));

    let deathMatch = null;
    for(let i=0;i<details.length;i++) for(let j=i+1;j<details.length;j++){
      const a=details[i], b=details[j], gap=Math.abs(a.gwPoints-b.gwPoints);
      if(!deathMatch || gap<deathMatch.gap) {
        const aNames=new Set(a.squad.filter(p=>p.position<=11).map(p=>p.name));
        const bNames=new Set(b.squad.filter(p=>p.position<=11).map(p=>p.name));
        deathMatch={
          a:{manager:a.manager,team:a.team,points:a.gwPoints,unique:a.squad.filter(p=>p.position<=11&&!bNames.has(p.name)).map(p=>p.name)},
          b:{manager:b.manager,team:b.team,points:b.gwPoints,unique:b.squad.filter(p=>p.position<=11&&!aNames.has(p.name)).map(p=>p.name)},
          gap
        };
      }
    }

    const rivalries=[];
    for(let i=0;i<details.length;i++) for(let j=i+1;j<details.length;j++){
      const a=details[i],b=details[j];
      const ah=Object.fromEntries(canonicalHistoryFor(a).map(h=>[h.gw,h.points]));
      const bh=Object.fromEntries(canonicalHistoryFor(b).map(h=>[h.gw,h.points]));
      let aw=0,bw=0,draw=0;
      for(const k of Object.keys(ah)) if(k in bh){
        if(ah[k]>bh[k]) aw++;
        else if(bh[k]>ah[k]) bw++;
        else draw++;
      }
      rivalries.push({a:a.manager,b:b.manager,aWins:aw,bWins:bw,draw});
    }

    // Realistic entertainment odds:
    // use CURRENT overall-point deficit to leader + recent form.
    // At the start of season, probabilities stay relatively flat.
    const leaderOverall = Math.max(...managerProfiles.map(p=>p.overall), 0);
    const seasonProgress = Math.max(1, Math.min(38, Number(gw))) / 38;
    const rawStrengths = managerProfiles.map(p => {
      const deficit = leaderOverall - p.overall;
      const deficitPenalty = deficit / (55 - 25*seasonProgress); // harsher later in season
      const formBoost = (p.avg3 - 50) / 18;
      const rankBoost = (details.length - p.rank) / Math.max(1, details.length-1);
      const rating = -deficitPenalty + formBoost + rankBoost;
      return {p, rating};
    });

    const temperature = seasonProgress < 0.2 ? 1.8 : seasonProgress < 0.5 ? 1.35 : 1.05;
    const expVals = rawStrengths.map(x => Math.exp(x.rating / temperature));
    const expSum = expVals.reduce((a,b)=>a+b,0) || 1;

    const virtualOdds = rawStrengths.map((x,i) => {
      const prob = expVals[i] / expSum;
      return {
        manager:x.p.manager,
        team:x.p.team,
        prob:Number((prob*100).toFixed(1)),
        odds:Number(Math.max(1.15, (1/prob)*1.08).toFixed(2))
      };
    }).sort((a,b)=>b.prob-a.prob);


    const rivalryProfiles = details.map(x => ({
      entry:x.entry,
      manager:x.manager,
      team:x.team,
      matches:rivalries
        .filter(r => r.a === x.manager || r.b === x.manager)
        .map(r => {
          const isA = r.a === x.manager;
          return {
            opponent:isA ? r.b : r.a,
            wins:isA ? r.aWins : r.bWins,
            losses:isA ? r.bWins : r.aWins,
            draws:r.draw
          };
        })
        .sort((a,b) => (b.wins-b.losses) - (a.wins-a.losses))
    }));

    const predictions = {
      label: gwFinished ? `Typ redakcji na GW${gw+1}` : `Typ redakcji od teraz w GW${gw}`,
      winner: managerProfiles.slice().sort((a,b)=>b.avg3-a.avg3)[0] || null,
      danger: managerProfiles.slice().sort((a,b)=>a.avg3-b.avg3)[0] || null
    };

    const grades = managerProfiles;

    // Current GW fun probabilities based on canonical league score + remaining starters.
    const liveStrength = details.map(x=>{
      const remaining=x.squad.filter(p=>p.position<=11&&!p.played).length;
      return {x,score:Number(x.gwPoints||0)+remaining*3.5};
    });
    const maxScore = Math.max(...liveStrength.map(z=>z.score), 0);
    const liveExp = liveStrength.map(z=>Math.exp((z.score-maxScore)/12));
    const liveSum = liveExp.reduce((a,b)=>a+b,0) || 1;
    const gwChances=liveStrength.map((z,i)=>({
      manager:z.x.manager,team:z.x.team,points:z.x.gwPoints,
      remaining:z.x.squad.filter(p=>p.position<=11&&!p.played).length,
      chance:Number((100*liveExp[i]/liveSum).toFixed(1))
    })).sort((a,b)=>b.chance-a.chance);

    const byRank = [...managerProfiles].sort((a,b)=>a.rank-b.rank);
    const byBench = [...managerProfiles].sort((a,b)=>b.benchSeason-a.benchSeason);
    const byHits = [...managerProfiles].sort((a,b)=>b.hitSeason-a.hitSeason);
    const byEditorial = [...managerProfiles].sort((a,b)=>b.editorial-a.editorial);
    const byBadEditorial = [...managerProfiles].sort((a,b)=>a.editorial-b.editorial);
    const byForm = [...managerProfiles].sort((a,b)=>b.avg3-a.avg3);
    const byBadForm = [...managerProfiles].sort((a,b)=>a.avg3-b.avg3);
    const byAverage = [...managerProfiles].sort((a,b)=>b.avg-a.avg);
    const byConsistency = [...managerProfiles].sort((a,b)=>{
      const as=(a.bestGW?.points??0)-(a.worstGW?.points??0);
      const bs=(b.bestGW?.points??0)-(b.worstGW?.points??0);
      return as-bs;
    });

    const seasonAwards = [
      byRank[0] && {icon:"👑",name:"MVP sezonu",p:byRank[0],value:`#${byRank[0].rank} • ${byRank[0].overall} pkt`},
      byEditorial[0] && {icon:"🧠",name:"Mózg sezonu",p:byEditorial[0],value:`ocena ${byEditorial[0].editorial}/10`},
      byBadEditorial[0] && {icon:"🏺",name:"Złoty Dzban",p:byBadEditorial[0],value:`ocena ${byBadEditorial[0].editorial}/10`},
      byBench[0] && {icon:"🪑",name:"Król ławki",p:byBench[0],value:`${byBench[0].benchSeason} pkt na ławce`},
      byHits[0] && {icon:"💸",name:"Transferowy kryminalista",p:byHits[0],value:`-${byHits[0].hitSeason} pkt w hitach`},
      byForm[0] && {icon:"🔥",name:"Najgorętsza forma",p:byForm[0],value:`${byForm[0].avg3} średnio / 3 GW`},
      byBadForm[0] && {icon:"🧊",name:"Lodówka sezonu",p:byBadForm[0],value:`${byBadForm[0].avg3} średnio / 3 GW`},
      byAverage[0] && {icon:"📈",name:"Najwyższa średnia",p:byAverage[0],value:`${byAverage[0].avg} pkt / GW`},
      byConsistency[0] && {icon:"🧱",name:"Mr. Stabilność",p:byConsistency[0],value:`spread ${(byConsistency[0].bestGW?.points??0)-(byConsistency[0].worstGW?.points??0)} pkt`},
      byRank.at(-1) && {icon:"🪦",name:"Piwnica tabeli",p:byRank.at(-1),value:`#${byRank.at(-1).rank} • ${byRank.at(-1).overall} pkt`}
    ].filter(Boolean).map(x=>({
      icon:x.icon,name:x.name,manager:x.p.manager,team:x.p.team,
      score:x.p.editorial,value:x.value
    }));

    return NextResponse.json({
      ok:true, league:{id:LEAGUE_ID,name:league.league.name}, gw,
      updatedAt:new Date().toISOString(),
      gwFinished,
      teamScoreSource:"league.standings.event_total",
      overallSource:"league.standings.total",
      pointsSource:`/event/${gw}/live/`,
      fixtureSource:`/fixtures/?event=${gw}`,
      standings:details,
      articles:finalArticles,
      awards, breakingNews:breakingNews.slice(0,8), managerProfiles, hallOfShame:shameRecords,
      watchList, deathMatch, rivalries, rivalryProfiles, virtualOdds, predictions, grades, gwChances, seasonAwards
    }, {headers:{"Cache-Control":"no-store, no-cache, must-revalidate, max-age=0"}});
  } catch(e) {
    return NextResponse.json({ok:false,error:String(e?.message||e)}, {status:500});
  }
}
