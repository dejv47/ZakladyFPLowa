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
    const live = await fpl(`/event/${gw}/live/`).catch(() => ({ elements: [] }));
    const livePoints = Object.fromEntries(
      (live.elements || []).map(x => [x.id, Number(x.stats?.total_points || 0)])
    );

    const players = Object.fromEntries(boot.elements.map(p => [p.id, p]));
    const teams = Object.fromEntries(boot.teams.map(t => [t.id, t]));

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
          points: Number(livePoints[x.element] || 0) * Number(x.multiplier || 0),
          rawPoints: Number(livePoints[x.element] || 0),
          captain: !!x.is_captain,
          multiplier: x.multiplier,
          position: x.position
        };
      });
      const starters=squad.filter(x=>x.position<=11);
      const bench=squad.filter(x=>x.position>11);
      const captain=squad.find(x=>x.captain);
      const best=starters.slice().sort((a,b)=>b.rawPoints-a.rawPoints)[0];
      const worst=starters.slice().sort((a,b)=>a.rawPoints-b.rawPoints)[0];
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

    const articles=[];

    const finishWord = gwFinished ? "po końcowym gwizdku kolejki" : "na ten moment";

    if (bestGW) {
      articles.push({
        tag: gwFinished ? "KRÓL KOLEJKI" : "NA RAZIE KRÓL",
        title: `${bestGW.team} rozjeżdża konkurencję. Reszta ligi może już odpalać wymówki`,
        body:
          `${bestGW.manager} ma ${bestGW.gwPoints} pkt ${finishWord} i prowadzi w klasyfikacji tej GW. ` +
          `${bestGW.best ? `Największy syf rywalom zrobił ${bestGW.best.name} z ${bestGW.best.club}, który dorzucił ${bestGW.best.rawPoints} pkt.` : ""} ` +
          `${bestGW.captain ? `Kapitan ${bestGW.captain.name} (${bestGW.captain.club}) dostarczył ${bestGW.captain.points} pkt po mnożniku, więc tym razem opaska nie została założona przez kompletnego debila.` : ""} ` +
          `Właściciel drużyny prawdopodobnie już uważa się za połączenie Guardioli, Monchiego i Nostradamusa. Spokojnie, mistrzu — jedna dobra kolejka nie kasuje miesięcy podejmowania decyzji jak człowiek, który pierwszy raz zobaczył piłkę nożną wczoraj wieczorem.`
      });
    }

    if (worstGW) {
      articles.push({
        tag: "KOMPROMITACJA KOLEJKI",
        title: `${worstGW.team} zagrało w FPL tak, jakby skład ustalał pijany losomat`,
        body:
          `${worstGW.manager} uzbierał ${worstGW.gwPoints} pkt ${finishWord}, czyli najgorszy wynik w naszej lidze. ` +
          `${worstGW.captain ? `Opaska trafiła do ${worstGW.captain.name} z ${worstGW.captain.club} i dała ${worstGW.captain.points} pkt. Jeśli to był plan, to plan był gówniany.` : ""} ` +
          `${worstGW.benchPoints > 0 ? `Na ławce zostało jeszcze ${worstGW.benchPoints} pkt, więc nawet rezerwowi mieli prawo patrzeć na pierwszą jedenastkę z pogardą.` : ""} ` +
          `Zarząd zapewnia, że sytuacja jest pod kontrolą. Patrząc na wynik, jedyną rzeczą pod kontrolą jest chyba poziom kompromitacji, bo skład wygląda jak ustawiony przez typa, który wszedł do FPL przez przypadek, szukając wyników Ekstraklasy.`
      });
    }

    if (benchKing?.benchPoints > 0) {
      articles.push({
        tag: "ŁAWKA HAŃBY",
        title: `${benchKing.team} trzyma punkty na ławce jak skarb narodowy`,
        body:
          `${benchKing.manager} zostawił ${benchKing.benchPoints} pkt poza podstawowym składem. To nie jest zarządzanie ławką, tylko magazynowanie cierpienia. ` +
          `${benchKing.best ? `${benchKing.best.name} (${benchKing.best.club}) zrobił ${benchKing.best.rawPoints} pkt i przynajmniej próbował ratować ten cyrk.` : ""} ` +
          `Jeśli rezerwowi mają WhatsAppa, to po tej kolejce powinni założyć osobną grupę bez menedżera i ustalać skład sami.`
      });
    }

    if (hitKing?.transferCost > 0) {
      articles.push({
        tag: "DYREKTOR SPORTOWY Z TEMU",
        title: `${hitKing.team} zapłaciło ${hitKing.transferCost} pkt za transfery. Chelsea pyta o CV`,
        body:
          `${hitKing.manager} wykonał ${hitKing.transfers} transferów i oddał ${hitKing.transferCost} pkt w hitach. ` +
          `To piękna koncepcja: najpierw samemu ukraść sobie punkty, a potem liczyć, że nowi zawodnicy oddadzą je z odsetkami. ` +
          `Efekt to ${hitKing.gwPoints} pkt w GW. Gdyby za chaos przyznawano bonusy, byłby to absolutny haul.`
      });
    }

    randoms.forEach((x,i)=>{
      const c=x.captain;
      const movement =
        x.lastRank > x.rank
          ? `awansował z ${x.lastRank}. na ${x.rank}. miejsce`
          : x.lastRank < x.rank
          ? `spadł z ${x.lastRank}. na ${x.rank}. miejsce`
          : `tkwi na ${x.rank}. miejscu jak korek w odpływie`;

      articles.push({
        tag:i===0 ? "REDAKCJA OBŚMIEWA" : "POD LUPĄ",
        title:`${x.team}: projekt sportowy istnieje, ale dowodów wciąż mało`,
        body:
          `${x.manager} zdobył ${x.gwPoints} pkt i ${movement}. ` +
          `${c ? `Kapitanem został ${c.name} z ${c.club}; po opasce przyniósł ${c.points} pkt. ${c.points <= 4 ? "Kapitan roku — jeśli rok trwał trzy minuty i był wyjątkowo smutny." : "Tym razem opaska nie wygląda jak akt samosabotażu."}` : ""} ` +
          `${x.best ? `Najlepszym zawodnikiem był ${x.best.name} (${x.best.club}) z ${x.best.rawPoints} pkt.` : ""} ` +
          `${x.benchPoints > 0 ? `Na ławce zostało ${x.benchPoints} pkt, bo najwyraźniej celem gry było utrudnić sobie życie.` : "Ławka przynajmniej nie śmieje się dziś najgłośniej."} ` +
          `Redakcja pozostaje przy stanowisku, że ten skład powinien być objęty nadzorem dorosłego.`
      });
    });

    return NextResponse.json({
      ok:true, league:{id:LEAGUE_ID,name:league.league.name}, gw,
      updatedAt:new Date().toISOString(),
      gwFinished,
      teamScoreSource:"league.standings.event_total",
      overallSource:"league.standings.total",
      pointsSource:`/event/${gw}/live/`,
      standings:details,
      articles
    }, {headers:{"Cache-Control":"no-store, no-cache, must-revalidate, max-age=0"}});
  } catch(e) {
    return NextResponse.json({ok:false,error:String(e?.message||e)}, {status:500});
  }
}
