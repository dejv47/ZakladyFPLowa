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
      const [picks, hist] = await Promise.all([
        fpl(`/entry/${row.entry}/event/${gw}/picks/`).catch(()=>null),
        fpl(`/entry/${row.entry}/history/`).catch(()=>null)
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
          position: x.position
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
        squad
      };
    }));

    const sorted=[...details].sort((a,b)=>b.gwPoints-a.gwPoints);
    const bestGW=sorted[0], worstGW=sorted.at(-1);
    const benchKing=[...details].sort((a,b)=>b.benchPoints-a.benchPoints)[0];
    const hitKing=[...details].sort((a,b)=>b.transferCost-a.transferCost)[0];
    const randoms=seeded(details.filter(x=>![bestGW?.entry,worstGW?.entry].includes(x.entry)), gw, 2);

    const articles = [];
    const finishWord = gwFinished ? "po zakończeniu kolejki" : "na ten moment";

    // Deterministic variation within a GW: text does not change randomly on every refresh,
    // but a new GW gets a different wording.
    const variants = (arr, salt = 0) => arr[(gw + salt) % arr.length];

    const scoreRoasts = [
      "wynik wygląda jak efekt ustawiania składu po sześciu piwach",
      "to jest FPL-owy odpowiednik wejścia na boisko w klapkach",
      "zarządzanie tym składem przypomina małpę napierdalającą losowe przyciski",
      "projekt sportowy wygląda, jakby dyrektora wybrano w konkursie z paczki chipsów",
      "to nie był pech — to była pełnoprawna produkcja gówna na skalę przemysłową"
    ];

    const captainRoasts = [
      "opaska została wykorzystana z gracją człowieka, który próbuje otworzyć konserwę młotkiem",
      "wybór kapitana wygląda jak decyzja podjęta przez kompletnego dzbana pięć sekund przed deadline'em",
      "literka C najwyraźniej oznaczała tutaj „chujowy pomysł”",
      "kapitan był tak trafiony, jakby wybierał go niewidomy dartem",
      "opaska zrobiła więcej szkody psychicznej właścicielowi niż pożytku punktowego"
    ];

    const benchRoasts = [
      "ławka urządziła właścicielowi publiczne upokorzenie",
      "rezerwowi mogą spokojnie założyć grupę „bez tego debila” i sami ustalać skład",
      "punkty na ławce leżały jak pieniądze na ulicy, a menedżer postanowił je ominąć",
      "pierwsza jedenastka patrzyła, jak rezerwowi robią robotę, i nawet nie było jej głupio",
      "to jest sztuka: mieć punkty w drużynie i specjalnie ich nie użyć"
    ];

    if (bestGW) {
      articles.push({
        tag: gwFinished ? "KRÓL TEGO BURDELU" : "NA RAZIE KRÓL",
        title: `${bestGW.team} rozjebało konkurencję. Rywale zaczynają produkcję wymówek`,
        body:
          `${bestGW.manager} ma ${bestGW.gwPoints} pkt ${finishWord} i jest najlepszy w tej GW. ` +
          `${bestGW.best ? `${bestGW.best.name} z ${bestGW.best.club} zrobił ${bestGW.best.rawPoints} pkt i był głównym powodem, dla którego reszta ligi ma dziś kwaśne miny.` : ""} ` +
          `${bestGW.captain ? (bestGW.captainHasPlayed ? `Kapitan ${bestGW.captain.name} (${bestGW.captain.club}) dowiózł ${bestGW.captain.points} pkt po mnożniku. Tym razem menedżer nie zjebał najważniejszej decyzji weekendu.` : `Kapitan ${bestGW.captain.name} (${bestGW.captain.club}) jeszcze nie grał, więc z otwieraniem szampana lepiej się wstrzymać.`) : ""} ` +
          `Teraz ${bestGW.manager} zapewne chodzi po domu jak Guardiola po zdobyciu mistrzostwa i udaje, że wszystko było częścią wielkiego planu.`
      });
    }

    if (worstGW) {
      articles.push({
        tag: "KOMPROMITACJA KOLEJKI",
        title: `${worstGW.team}: ktoś powinien odebrać menedżerowi hasło do FPL`,
        body:
          `${worstGW.manager} ma ${worstGW.gwPoints} pkt ${finishWord}, czyli najmniej w całej lidze. ${variants(scoreRoasts, 1)}. ` +
          `${worstGW.captain ? (worstGW.captainHasPlayed ? `${worstGW.captain.name} z ${worstGW.captain.club} jako kapitan dał ${worstGW.captain.points} pkt. ${variants(captainRoasts, 2)}.` : `Kapitan ${worstGW.captain.name} (${worstGW.captain.club}) jeszcze nie grał, więc istnieje cień szansy, że ten pierdolnik da się jeszcze trochę posprzątać.`) : ""} ` +
          `${worstGW.benchPoints > 0 ? `Do tego ${worstGW.benchPoints} pkt kisi się na ławce. ${variants(benchRoasts, 3)}.` : ""} ` +
          `Zarząd oficjalnie milczy, prawdopodobnie ze wstydu.`
      });
    }

    if (benchKing?.benchPoints > 0) {
      articles.push({
        tag: "ŁAWKA HAŃBY",
        title: `${benchKing.team} zostawiło ${benchKing.benchPoints} pkt na ławce. No kurwa, brawo`,
        body:
          `${benchKing.manager} zgromadził ${benchKing.benchPoints} pkt na rezerwie, czyli stworzył całkiem niezły wynik dla drużyny, której postanowił nie wystawić. ` +
          `${variants(benchRoasts, 4)}. ` +
          `${benchKing.best ? `W podstawie honor ratował ${benchKing.best.name} z ${benchKing.best.club}, zdobywając ${benchKing.best.rawPoints} pkt.` : ""} ` +
          `Sztab szkoleniowy podobno analizuje nowatorską koncepcję: w następnej kolejce wystawić tych, którzy zdobywają punkty.`
      });
    }

    if (hitKing?.transferCost > 0) {
      articles.push({
        tag: "TRANSFEROWY KRETYŃSKI MASTERPLAN",
        title: `${hitKing.team} samo sobie odjęło ${hitKing.transferCost} pkt. Geniusz kurwa`,
        body:
          `${hitKing.manager} zrobił ${hitKing.transfers} transferów i zapłacił za tę rewolucję ${hitKing.transferCost} pkt. ` +
          `To strategia godna dyrektora sportowego z Temu: najpierw rozpierdolić własny dorobek, a potem modlić się, żeby nowe nabytki go odzyskały. ` +
          `Bilans GW wynosi ${hitKing.gwPoints} pkt. Chelsea podobno chciała zatrudnić autora tego planu, ale nawet oni uznali, że to przesada.`
      });
    }

    // 5. Captain disaster — only managers whose captain's real fixture has started.
    const captainCandidates = details
      .filter(x => x.captain && x.captainHasPlayed)
      .sort((a,b) => (a.captain?.points ?? 0) - (b.captain?.points ?? 0));
    const captainDisaster = captainCandidates[0];

    if (captainDisaster) {
      articles.push({
        tag: "KAPITAN Z DUPY",
        title: `${captainDisaster.team} zaufało ${captainDisaster.captain.name}. I po chuj?`,
        body:
          `${captainDisaster.manager} dał opaskę ${captainDisaster.captain.name} z ${captainDisaster.captain.club}, a ten po mnożniku przyniósł ${captainDisaster.captain.points} pkt. ` +
          `${variants(captainRoasts, 5)}. ` +
          `${captainDisaster.best && captainDisaster.best.name !== captainDisaster.captain.name ? `Najlepszy zawodnik tej ekipy, ${captainDisaster.best.name} (${captainDisaster.best.club}), zrobił ${captainDisaster.best.rawPoints} pkt bez żadnej pieprzonej opaski.` : ""} ` +
          `Po deadline'ie każdy jest mądry, ale tutaj nawet przed deadline'em można było mieć podejrzenia.`
      });
    }

    // 6. Biggest rank fall / rise drama.
    const fallers = details
      .filter(x => Number.isFinite(x.lastRank) && Number.isFinite(x.rank) && x.rank > x.lastRank)
      .sort((a,b) => (b.rank-b.lastRank) - (a.rank-a.lastRank));
    const biggestFaller = fallers[0];

    if (biggestFaller) {
      const drop = biggestFaller.rank - biggestFaller.lastRank;
      articles.push({
        tag: "W DÓŁ JAK KAMIEŃ",
        title: `${biggestFaller.team} spada o ${drop} ${drop === 1 ? "miejsce" : "miejsca"}. Winda działa, tylko kurwa w dół`,
        body:
          `${biggestFaller.manager} zjechał z ${biggestFaller.lastRank}. na ${biggestFaller.rank}. miejsce i uzbierał ${biggestFaller.gwPoints} pkt. ` +
          `${biggestFaller.best ? `${biggestFaller.best.name} z ${biggestFaller.best.club} próbował ratować sytuację wynikiem ${biggestFaller.best.rawPoints} pkt, ale jeden strażak nie ugasi całego płonącego śmietnika.` : ""} ` +
          `${biggestFaller.benchPoints > 0 ? `Na ławce zostało jeszcze ${biggestFaller.benchPoints} pkt, bo najwyraźniej sam spadek w tabeli był zbyt mało bolesny.` : ""} ` +
          `Jeżeli tempo się utrzyma, następny raport trzeba będzie pisać z piwnicy tabeli.`
      });
    }

    // 7. Random roast — choose one stable manager per GW, but wording varies by GW.
    const randomPool = details.filter(x =>
      ![bestGW?.entry, worstGW?.entry, benchKing?.entry, hitKing?.entry, captainDisaster?.entry, biggestFaller?.entry]
        .includes(x.entry)
    );
    const randomVictim = seeded(randomPool.length ? randomPool : details, gw + 17, 1)[0];

    if (randomVictim) {
      const c = randomVictim.captain;
      const movement =
        randomVictim.lastRank > randomVictim.rank
          ? `awansował z ${randomVictim.lastRank}. na ${randomVictim.rank}. miejsce`
          : randomVictim.lastRank < randomVictim.rank
          ? `spadł z ${randomVictim.lastRank}. na ${randomVictim.rank}. miejsce`
          : `siedzi na ${randomVictim.rank}. miejscu i udaje, że wszystko idzie zgodnie z planem`;

      articles.push({
        tag: "LOSOWY OPIERDOL REDAKCJI",
        title: `${randomVictim.team} trafia dziś pod ostrzał. Bez konkretnego powodu też by się należało`,
        body:
          `${randomVictim.manager} ma ${randomVictim.gwPoints} pkt i ${movement}. ` +
          `${c ? (randomVictim.captainHasPlayed ? `Kapitan ${c.name} (${c.club}) dał ${c.points} pkt po mnożniku. ${c.points <= 4 ? variants(captainRoasts, 6) : "Przynajmniej tutaj nie udało się wszystkiego spierdolić."}` : `${c.name} (${c.club}) czeka jeszcze na swój mecz, więc opaska nadal może uratować albo kompletnie dojebać tę kolejkę.`) : ""} ` +
          `${randomVictim.best ? `Najlepszy był ${randomVictim.best.name} z ${randomVictim.best.club} — ${randomVictim.best.rawPoints} pkt.` : "Żaden zawodnik z rozegranym meczem nie zrobił jeszcze niczego, czym warto się chwalić."} ` +
          `${randomVictim.benchPoints > 0 ? `Ławka ma ${randomVictim.benchPoints} pkt, czyli tradycyjnie część drużyny zarządzana przez menedżera najmniej aktywnie radzi sobie całkiem nieźle.` : ""} ` +
          `Redakcja będzie obserwować dalszy rozwój tego burdelu z należytą pogardą.`
      });
    }

    // Always cap at seven categories/articles.
    const finalArticles = articles.slice(0, 7);

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
