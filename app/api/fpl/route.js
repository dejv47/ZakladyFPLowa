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
      const hs = canonicalHistoryFor(x).filter(h => h.gw < gw || gwFinished);
      const last3 = hs.slice(-3);
      const trend = last3.length >= 3 ? last3[2].points - last3[0].points : 0;
      const spread = bestGW && worstGW ? bestGW.points - worstGW.points : 0;

      // Guaranteed unique skeleton per manager entry.
      // Even if two managers have identical stats, their full profile text is built from a different template.
      const templates = [
        (p)=>`${x.manager} prowadzi ${x.team} jak człowiek, który przed każdym deadline'em ma trzy plany, cztery wątpliwości i jeden przycisk, którego nie powinien naciskać. Jest ${x.rank}. w lidze, ma ocenę ${editorial}/10, formę ${avg3.toFixed(1)} z ostatnich trzech zakończonych GW, ${benchSeason} pkt zostawionych na ławce i ${hitSeason} pkt wydanych na hity. ${trend>0?`Trend +${trend} sugeruje, że ten chaos zaczyna działać.`:trend<0?`Trend ${trend} wygląda jak zjazd windą bez hamulców.`:`Trend stoi w miejscu, czyli przynajmniej nic się nie pali bardziej niż zwykle.`} ${spread>0?`Między najlepszą i najgorszą GW ma ${spread} pkt różnicy — emocjonalny rollercoaster gratis.`:""} Redakcja: projekt żyje, właściciel też, choć czasem obaj wyglądają na zmęczonych.`,
        (p)=>`${x.manager} i ${x.team} to osobny gatunek FPL-owej biologii. Ranking #${x.rank}, rating ${editorial}/10, średnia formy ${avg3.toFixed(1)}, bench tax ${benchSeason}, transfer tax ${hitSeason}. ${bestGW?`Najlepszy wyskok: ${bestGW.points} pkt w GW${bestGW.gw}.`:""} ${worstGW?`Największy zgon: ${worstGW.points} pkt w GW${worstGW.gw}.`:""} ${trend>=15?`Forma idzie ostro w górę i menedżer pewnie już uważa się za Guardiolę.`:trend<=-15?`Forma leci w dół i nawet PR-owiec zaczyna się pocić.`:`Forma porusza się spokojnie, jakby bała się zwrócić na siebie uwagę.`} Werdykt: nie wiadomo, czy to strategia, czy seria zbiegów okoliczności, ale materiału do gazety nie brakuje.`,
        (p)=>`Raport śledczy dotyczący ${x.manager}: klub ${x.team}, pozycja ${x.rank}, ocena ${editorial}/10. W aktach: ${avg3.toFixed(1)} pkt średnio z 3 GW, ${benchSeason} pkt na ławce, ${hitSeason} pkt kosztów transferowych i rozrzut formy ${spread}. ${benchSeason>=40?`Ławka wygląda jak alternatywna jedenastka, która regularnie gra lepiej od tej właściwej.`:`Ławka na razie nie generuje materiału dowodowego na większy kryminał.`} ${hitSeason>=12?`Dział transferów działa jak kasyno po północy.`:`Transfery są zaskakująco powściągliwe jak na standardy tej ligi.`} Redakcja zamyka teczkę tylko do następnego deadline'u.`,
        (p)=>`${x.team} pod wodzą ${x.manager} jest jak serial, którego nikt nie chce kończyć, bo co kolejkę pojawia się nowy absurd. Aktualnie #${x.rank}, editorial score ${editorial}/10, forma ${avg3.toFixed(1)}, ławka ${benchSeason}, hity ${hitSeason}. ${trend>10?`Ostatnie tygodnie są wyraźnie lepsze, więc narracja o „procesie” chwilowo ma sens.`:trend<-10?`Ostatnie tygodnie wyglądają jak sequel katastrofy, którego nikt nie zamawiał.`:`Ostatnie tygodnie są stabilne, czyli nuda — ale zdrowa.`} ${bestGW&&worstGW?`Od ${worstGW.points} do ${bestGW.points} pkt między skrajnymi kolejkami: pełne spektrum od „geniusz” do „co on odpierdolił”.`:""} `,
        (p)=>`${x.manager}: profil operacyjny ${x.team}. Pozycja ${x.rank}. Forma 3 GW ${avg3.toFixed(1)}. Ocena ${editorial}/10. Rezerwa: ${benchSeason} pkt. Koszt eksperymentów transferowych: ${hitSeason}. ${editorial>=7?`Na ten moment wygląda to zaskakująco profesjonalnie.`:editorial>=5?`Jest poprawnie, ale redakcja nadal trzyma gaśnicę pod ręką.`:`To wygląda jak projekt prowadzony na zasadzie „zobaczymy, co się stanie”, a niestety widzimy.`} ${trend>0?`Kierunek jest dodatni (+${trend}).`:`Kierunek nie pomaga (${trend}).`} Ten profil ma własny zapach: trochę analizy, trochę paniki i zawsze za dużo pewności po dobrym haul'u.`,
        (p)=>`Gdyby ${x.manager} był trenerem w Premier League, konferencje prasowe po meczach ${x.team} trwałyby długo. Powód: #${x.rank} w tabeli, ${avg3.toFixed(1)} formy, ${benchSeason} pkt zmarnowanych na ławce i ${hitSeason} w hitach. ${editorial>=8?`Rating ${editorial}/10 daje prawo do kozaczenia.`:editorial<=4?`Rating ${editorial}/10 daje raczej prawo do przeprosin.`:`Rating ${editorial}/10 daje głównie prawo do dalszego kombinowania.`} ${spread>=40?`Rozrzut ${spread} pkt między skrajnymi GW pokazuje, że stabilność to tutaj pojęcie teoretyczne.`:""} `,
        (p)=>`Kartoteka ${x.manager} — ${x.team}: #${x.rank}, ocena ${editorial}/10, forma ${avg3.toFixed(1)}, bench ${benchSeason}, hits ${hitSeason}. ${bestGW?`Szczyt sezonu: ${bestGW.points} pkt.`:""} ${worstGW?`Dno sezonu: ${worstGW.points} pkt.`:""} ${trend>=20?`Ostatnio ostro odbija i zaraz będzie opowiadał, że wszystko było zaplanowane.`:trend<=-20?`Ostatnio ostro tonie i zaczyna brakować eleganckich określeń.`:`Ostatnio jedzie po płaskim terenie.`} Redakcja klasyfikuje przypadek jako: ${editorial>=7?"wkurwiająco kompetentny":editorial>=5?"niegroźny, ale obserwować":editorial>=3.5?"podejrzany":"zagrożenie dla własnego rankingu"}.`,
        (p)=>`${x.team} ma nazwę, herb i ${x.manager}. Największym znakiem zapytania nadal pozostaje trzeci element. Liczby: miejsce ${x.rank}, ${avg3.toFixed(1)} średnio z 3 GW, rating ${editorial}/10, ${benchSeason} na ławce, ${hitSeason} kosztów. ${benchSeason>=50?`Rezerwowi mają podstawy do buntu.`:""} ${hitSeason>=16?`Księgowość ma podstawy do zawiadomienia organów ścigania.`:""} ${trend<0?`Forma ma kierunek ujemny.`:`Forma przynajmniej nie ucieka w dół.`} To profil, który nie potrzebuje fikcji — statystyki same piszą punchline'y.`,
        (p)=>`${x.manager} w sezonie ${x.team}: obecnie ${x.rank}. miejsce i ${editorial}/10 od redakcji. Z ostatnich trzech zakończonych kolejek średnio ${avg3.toFixed(1)}, z ławki wyparowało ${benchSeason}, a dodatkowe transfery kosztowały ${hitSeason}. ${spread?`Zakres między best i worst GW: ${spread} pkt.`:""} ${trend>0?`Trend jest dodatni i właściciel może przez chwilę spać spokojniej.`:`Trend nie daje komfortu.`} Jeśli ten sezon byłby filmem, gatunek to ${editorial>=7?"sportowy dramat z happy endem w zasięgu":editorial>=5?"komedia obyczajowa":"horror psychologiczny"}.`,
        (p)=>`Analiza techniczna ${x.manager}: ${x.team} zajmuje #${x.rank}, wskaźnik formy ${avg3.toFixed(1)}, wskaźnik cierpienia ławkowego ${benchSeason}, koszt FOMO transferowego ${hitSeason}, ocena ${editorial}/10. ${bestGW&&worstGW?`Ekstrema: ${bestGW.points}/${worstGW.points}.`:""} ${trend>=10?`Momentum rośnie.`:trend<=-10?`Momentum zdechło.`:`Momentum śpi.`} Redakcja zaleca ${editorial>=7?"nie dotykać za dużo, bo jeszcze zepsuje":"przemyśleć kilka rzeczy przed kolejnym kliknięciem Confirm Transfers"}.`,
        (p)=>`${x.manager} jest dziś przypadkiem testowym pod tytułem „ile można wycisnąć z ${x.team} bez pełnego załamania nerwowego”. Wynik eksperymentu: pozycja ${x.rank}, rating ${editorial}/10, forma ${avg3.toFixed(1)}, bench ${benchSeason}, hits ${hitSeason}. ${trend>15?`Eksperyment ostatnio działa coraz lepiej.`:trend<-15?`Eksperyment ostatnio wymyka się spod kontroli.`:`Eksperyment jest stabilny.`} ${spread>30?`Wahania ${spread} pkt pokazują, że laboratorium czasem eksploduje.`:""} `,
        (p)=>`Profil ryzyka ${x.manager}/${x.team}: ranking #${x.rank}, redakcja ${editorial}/10, ostatnie 3 GW ${avg3.toFixed(1)}, ławka ${benchSeason}, minusy transferowe ${hitSeason}. ${editorial<5?`Poziom ryzyka wysoki — każde kolejne kliknięcie może pogorszyć sytuację.`:editorial<7?`Poziom ryzyka średni — da się żyć.`:`Poziom ryzyka niski — przynajmniej do następnej głupoty.`} ${trend>=0?`Trend ${trend} nie straszy.`:`Trend ${trend} straszy bardziej niż powinien.`} `,
        (p)=>`${x.manager} prowadzi ${x.team} z charakterystyczną mieszanką ${editorial>=7?"rozsądku i bezczelnej skuteczności":editorial>=5?"rozsądku i chaosu":"chaosu i kolejnego chaosu"}. #${x.rank}, ${avg3.toFixed(1)} formy, ${benchSeason} bench, ${hitSeason} hits. ${bestGW?`Najlepszy moment: ${bestGW.points}.`:""} ${worstGW?`Najgorszy: ${worstGW.points}.`:""} To profil, którego nie da się pomylić z innym, bo nawet błędy mają własny styl.`,
        (p)=>`Jeśli ktoś szuka definicji sezonu ${x.manager}, wystarczy pięć liczb: #${x.rank}, ${editorial}/10, ${avg3.toFixed(1)}, ${benchSeason}, ${hitSeason}. ${trend>0?`Trend +${trend} daje paliwo do optymizmu.`:`Trend ${trend} zabiera paliwo.`} ${spread>0?`Rozrzut ${spread} pokazuje skalę emocji.`:""} ${x.team} pozostaje klubem, w którym każde GW może skończyć się albo masterclassem, albo dochodzeniem komisji.`,
        (p)=>`${x.team} i ${x.manager}: sezon oceniany na ${editorial}/10, miejsce ${x.rank}. Forma ${avg3.toFixed(1)}, bench ${benchSeason}, hits ${hitSeason}. ${benchSeason>hitSeason*3?`Największym przeciwnikiem jest własna ławka.`:hitSeason>benchSeason/3?`Największym przeciwnikiem jest własny dział transferów.`:`Największym przeciwnikiem pozostaje zwykły pech i czasem zdrowy rozsądek.`} `,
        (p)=>`Redakcja wystawia ${x.manager} kartę zawodniczą: ${x.team}, #${x.rank}, ${editorial}/10, ${avg3.toFixed(1)} avg3, ${benchSeason} bench pts, ${hitSeason} hit cost. ${trend>=15?"⬆️ forma wyraźnie rośnie":trend<=-15?"⬇️ forma wyraźnie spada":"➡️ forma stoi"}. ${spread>=35?`Wahania ${spread} są bardziej widowiskowe niż połowa meczów ligowych.`:""} `,
        (p)=>`${x.manager} nie ma takiego samego profilu jak reszta, bo ${x.team} nie robi nic normalnie. Aktualnie #${x.rank}, rating ${editorial}/10, forma ${avg3.toFixed(1)}, ławka ${benchSeason}, transfery ${hitSeason}. ${trend>0?`Ostatnio poprawa.`:`Ostatnio brak poprawy.`} ${editorial>=7?`Jeśli utrzyma poziom, roast będzie coraz trudniejszy.`:`Jeśli utrzyma poziom, roast napisze się sam.`} `,
        (p)=>`Dziennik obserwacyjny: ${x.manager}. Klub: ${x.team}. Stan: ${editorial>=7?"stabilny":editorial>=5?"chwiejny":"alarmowy"}. Ranking ${x.rank}, forma ${avg3.toFixed(1)}, bench waste ${benchSeason}, hit waste ${hitSeason}, spread ${spread}. ${trend>=0?`Zmiana formy ${trend>=0?"+":""}${trend}.`:`Spadek ${trend}.`} Redakcja zaleca dalszą obserwację i ograniczenie nagłych decyzji po godzinie 22.`,
        (p)=>`${x.manager} ma sezon, który można czytać z liczb: ${x.rank}. miejsce, ${editorial}/10, ${avg3.toFixed(1)} z 3 GW, ${benchSeason} na ławce, ${hitSeason} na hitach. ${bestGW&&worstGW?`Najlepsza/najgorsza: ${bestGW.points}/${worstGW.points}.`:""} ${trend>0?`Narracja idzie w górę razem z formą.`:`Narracja robi się coraz trudniejsza do obrony.`} ${x.team} pozostaje wdzięcznym źródłem materiału.`,
        (p)=>`Portret menedżera ${x.manager}: prowadzi ${x.team}, jest #${x.rank}, ma ${editorial}/10. Ostatnie 3 GW: ${avg3.toFixed(1)}. Ławka: ${benchSeason}. Hity: ${hitSeason}. ${spread>25?`Rozrzut ${spread} oznacza, że przewidywalność nie jest mocną stroną.`:`Wyniki są relatywnie stabilne.`} ${trend>=10?`Forma rośnie i właściciel może chwilowo chodzić dumny.`:trend<=-10?`Forma spada i właściciel powinien przestać udawać, że wszystko jest okej.`:`Forma stoi.`} `
      ];

      const idx = Math.abs(Number(x.entry)) % templates.length;
      const uniqueCore = templates[idx](x);

      // Mandatory unique signature line ensures no two complete descriptions can ever be identical.
      const signature = `Sygnatura profilu: ${x.manager} • ${x.team} • entry ${x.entry} • GW${gw}.`;

      return `${uniqueCore} ${typeof teamNameRoasts === "function" ? teamNameRoasts(x.team, x.entry + gw*3) : ""} ${signature}`;
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

    // Hall of Shame v26: fixed broad category set.
    // Categories do not disappear just because the current value is zero.
    const completedProfiles = managerProfiles;

    const pickMin = (arr, getter) =>
      arr.length ? [...arr].sort((a,b)=>getter(a)-getter(b))[0] : null;
    const pickMax = (arr, getter) =>
      arr.length ? [...arr].sort((a,b)=>getter(b)-getter(a))[0] : null;

    const worstGwOwner = pickMin(
      completedProfiles.filter(p=>p.worstGW && p.worstGW.gw > 0),
      p=>p.worstGW.points
    );

    const benchOwner = pickMax(completedProfiles, p=>p.benchSeason || 0);
    const hitOwner = pickMax(completedProfiles, p=>p.hitSeason || 0);
    const rollerOwner = pickMax(
      completedProfiles.filter(p=>p.bestGW && p.worstGW),
      p=>(p.bestGW.points-p.worstGW.points)
    );
    const coldOwner = pickMin(completedProfiles.filter(p=>p.avg3>0), p=>p.avg3);
    const badRatingOwner = pickMin(completedProfiles, p=>p.editorial);
    const cellarOwner = pickMax(completedProfiles, p=>p.rank);
    const lowAverageOwner = pickMin(completedProfiles.filter(p=>p.avg>0), p=>p.avg);
    const worstFormOwner = pickMin(completedProfiles.filter(p=>p.avg3>0), p=>p.avg3);
    const unstableOwner = pickMax(
      completedProfiles.filter(p=>p.bestGW && p.worstGW),
      p=>(p.bestGW.points-p.worstGW.points)
    );

    const shameRecords = [
      {
        kind:"💀 Najgorszy wynik GW",
        manager:worstGwOwner?.manager || "—",
        team:worstGwOwner?.team || "Brak danych",
        value:worstGwOwner?.worstGW ? `${worstGwOwner.worstGW.points} pkt (GW${worstGwOwner.worstGW.gw})` : "Jeszcze brak zakończonej GW"
      },
      {
        kind:"🪑 Król ławki",
        manager:benchOwner?.manager || "—",
        team:benchOwner?.team || "Brak danych",
        value:(benchOwner?.benchSeason || 0) > 0 ? `${benchOwner.benchSeason} pkt na ławce` : "0 pkt — na razie brak kompromitacji"
      },
      {
        kind:"💸 Transferowy kryminalista",
        manager:hitOwner?.manager || "—",
        team:hitOwner?.team || "Brak danych",
        value:(hitOwner?.hitSeason || 0) > 0 ? `-${hitOwner.hitSeason} pkt w hitach` : "0 pkt — jeszcze nikt nie odpierdolił hitów"
      },
      {
        kind:"🎢 Rollercoaster sezonu",
        manager:rollerOwner?.manager || "—",
        team:rollerOwner?.team || "Brak danych",
        value:rollerOwner?.bestGW && rollerOwner?.worstGW
          ? `${rollerOwner.bestGW.points-rollerOwner.worstGW.points} pkt różnicy`
          : "Za mało zakończonych GW"
      },
      {
        kind:"🧊 Lodówka — najgorsza forma 3 GW",
        manager:coldOwner?.manager || "—",
        team:coldOwner?.team || "Brak danych",
        value:coldOwner?.avg3 > 0 ? `${coldOwner.avg3} pkt średnio` : "Za mało historii"
      },
      {
        kind:"🏺 Złoty Dzban redakcji",
        manager:badRatingOwner?.manager || "—",
        team:badRatingOwner?.team || "Brak danych",
        value:badRatingOwner ? `${badRatingOwner.editorial}/10` : "Brak danych"
      },
      {
        kind:"🕳️ Piwnica tabeli",
        manager:cellarOwner?.manager || "—",
        team:cellarOwner?.team || "Brak danych",
        value:cellarOwner ? `${cellarOwner.rank}. miejsce` : "Brak danych"
      },
      {
        kind:"📉 Najniższa średnia sezonu",
        manager:lowAverageOwner?.manager || "—",
        team:lowAverageOwner?.team || "Brak danych",
        value:lowAverageOwner?.avg > 0 ? `${lowAverageOwner.avg} pkt / GW` : "Za mało zakończonych GW"
      },
      {
        kind:"🥶 Najgorszy trend formy",
        manager:worstFormOwner?.manager || "—",
        team:worstFormOwner?.team || "Brak danych",
        value:worstFormOwner?.avg3 > 0 ? `${worstFormOwner.avg3} średnio z 3 GW` : "Za mało historii"
      },
      {
        kind:"🎰 Największa niestabilność",
        manager:unstableOwner?.manager || "—",
        team:unstableOwner?.team || "Brak danych",
        value:unstableOwner?.bestGW && unstableOwner?.worstGW
          ? `${unstableOwner.bestGW.points} ↔ ${unstableOwner.worstGW.points}`
          : "Za mało zakończonych GW"
      }
    ];

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
