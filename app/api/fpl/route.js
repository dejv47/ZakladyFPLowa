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

    const current = boot.events.find(e => e.is_current) || boot.events.find(e => e.is_next) || boot.events.at(-1);
    const gw = current?.id || 1;
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
          points: Number(p.event_points||0) * Number(x.multiplier||0),
          rawPoints: Number(p.event_points||0),
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
        gwPoints: picks?.entry_history?.points ?? row.event_total ?? h?.points ?? 0,
        benchPoints: h?.points_on_bench ?? bench.reduce((s,x)=>s+x.rawPoints,0),
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
    if(bestGW) articles.push({
      tag:"BOHATER KOLEJKI",
      title:`${bestGW.team} urządza pokaz siły. Reszta ligi może już pisać skargi`,
      body:`${bestGW.manager} wyciągnął ${bestGW.gwPoints} pkt i na ten moment wygrał kolejkę w naszej lidze. Najwięcej roboty zrobił ${bestGW.best?.name || "lider składu"} z ${bestGW.best?.club || "Premier League"}, który dorzucił ${bestGW.best?.rawPoints || 0} pkt. ${bestGW.captain ? `Opaska trafiła do ${bestGW.captain.name} (${bestGW.captain.club}) i przyniosła ${bestGW.captain.points} pkt po mnożniku.` : ""} Na konferencji prasowej nie padło jeszcze słowo „geniusz”, ale właściciel drużyny prawdopodobnie już je wpisał w bio.`
    });
    if(worstGW) articles.push({
      tag:"KOMPROMITACJA",
      title:`Alarm w ${worstGW.team}. Kolejka, o której najlepiej zapomnieć`,
      body:`${worstGW.manager} uzbierał ${worstGW.gwPoints} pkt, czyli najmniej w naszej lidze. ${worstGW.worst ? `${worstGW.worst.name} z ${worstGW.worst.club} dołożył imponujące ${worstGW.worst.rawPoints} pkt i trudno powiedzieć, żeby uratował projekt.` : ""} ${worstGW.benchPoints ? `Na ławce zostało dodatkowo ${worstGW.benchPoints} pkt — luksus, na który pierwsza jedenastka najwyraźniej mogła tylko popatrzeć.` : ""} Zarząd zapewnia, że trener ma pełne poparcie. Jak wiadomo, takie komunikaty nigdy niczego złego nie zapowiadają.`
    });
    if(benchKing?.benchPoints>0) articles.push({
      tag:"ŁAWKA PREMIUM",
      title:`${benchKing.team} kolekcjonuje punkty. Niestety poza boiskiem`,
      body:`Aż ${benchKing.benchPoints} pkt zostało na ławce ${benchKing.manager}. W świecie FPL jest to odpowiednik kupienia Ferrari i trzymania go pod plandeką. ${benchKing.best ? `Tymczasem ${benchKing.best.name} (${benchKing.best.club}) był jednym z tych, którzy faktycznie próbowali ratować wynik.` : ""} Komisja ligi bada, czy ustawienie składu odbywało się przed kawą.`
    });
    if(hitKing?.transferCost>0) articles.push({
      tag:"DZIAŁ TRANSFERÓW",
      title:`${hitKing.team} zapłacił za zakupy. Dosłownie`,
      body:`${hitKing.manager} wykonał ${hitKing.transfers} transferów i oddał ${hitKing.transferCost} pkt w hitach. To odważna polityka kadrowa: najpierw samemu odjąć sobie punkty, a dopiero później próbować je odzyskać na boisku. Efekt kolejki to ${hitKing.gwPoints} pkt. Chelsea podobno pytała o numer do dyrektora sportowego.`
    });
    randoms.forEach((x,i)=>{
      const c=x.captain;
      articles.push({
        tag:i===0?"POD LUPĄ":"PRASA DONOSI",
        title:`${x.team}: eksperci próbują zrozumieć plan i proszą o więcej czasu`,
        body:`${x.manager} kończy obecną kolejkę z ${x.gwPoints} pkt i zajmuje ${x.rank}. miejsce w lidze. ${c ? `Kapitanem został ${c.name} z ${c.club}, który po uwzględnieniu opaski dostarczył ${c.points} pkt.` : ""} ${x.best ? `Najmocniejszym punktem jedenastki był ${x.best.name} (${x.best.club}) — ${x.best.rawPoints} pkt.` : ""} ${x.benchPoints ? `Problem w tym, że ławka patrzyła na to wszystko z dorobkiem ${x.benchPoints} pkt.` : "Przynajmniej ławka tym razem nie miała powodów do śmiechu."} Redakcja pozostaje w gotowości na kolejne decyzje, których nikt nie będzie umiał racjonalnie wyjaśnić.`
      });
    });

    return NextResponse.json({
      ok:true, league:{id:LEAGUE_ID,name:league.league.name}, gw,
      updatedAt:new Date().toISOString(), standings:details, articles
    }, {headers:{"Cache-Control":"no-store, no-cache, must-revalidate, max-age=0"}});
  } catch(e) {
    return NextResponse.json({ok:false,error:String(e?.message||e)}, {status:500});
  }
}
