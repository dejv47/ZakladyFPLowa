import { NextResponse } from "next/server";
import { bets } from "../../../lib/bets";
import {
  getPremierLeagueStandings,
  getPlayerStats,
  getManchesterDerbies,
  findStanding
} from "../../../lib/apiFootball";

export const dynamic = "force-dynamic";

function money(n) {
  return `${n.toFixed(2).replace(".", ",")} zł`;
}

export async function GET() {
  try {
    const autoBets = bets.filter(b => b.mode !== "manual");

    const players = new Set();
    for (const b of autoBets) {
      if (b.mode === "player-ga-versus") {
        players.add(b.live.a);
        players.add(b.live.b);
      }
      if (b.mode === "player-goals-condition") players.add(b.live.player);
      if (b.mode === "player-ga-sum") {
        players.add(b.live.a);
        b.live.b.forEach(x => players.add(x));
      }
    }

    const [standings, derbies, ...playerRows] = await Promise.all([
      getPremierLeagueStandings(),
      getManchesterDerbies(),
      ...[...players].map(getPlayerStats)
    ]);

    const stats = {};
    [...players].forEach((name, i) => stats[name] = playerRows[i]);

    const results = bets.map(b => {
      const base = {
        id: b.id,
        people: b.people,
        title: b.title,
        pick: b.pick,
        amount: money(b.amount),
        note: b.note,
        mode: b.mode,
        status: "Trwa",
        liveText: "Ręczne rozliczenie",
        leader: null
      };

      if (b.mode === "manual") return base;

      if (b.mode === "standings-condition") {
        const s = findStanding(standings, b.live.team);
        if (!s) return { ...base, liveText: "Brak danych" };
        return {
          ...base,
          liveText: `${s.team}: ${s.rank}. miejsce • ${s.points} pkt • ${s.played} meczów`,
          leader: s.rank > 4 ? "Pachana" : "Dejv"
        };
      }

      if (b.mode === "standings-versus") {
        const a = findStanding(standings, b.live.a);
        const c = findStanding(standings, b.live.b);
        if (!a || !c) return { ...base, liveText: "Brak danych" };
        return {
          ...base,
          liveText: `${a.team}: ${a.rank}. (${a.points} pkt) — ${c.team}: ${c.rank}. (${c.points} pkt)`,
          leader: a.rank < c.rank ? "Pierwszy typ" : c.rank < a.rank ? "Drugi typ" : "Remis"
        };
      }

      if (b.mode === "h2h-win") {
        const finished = derbies.filter(x => ["FT", "AET", "PEN"].includes(x.status));
        const unitedWin = finished.some(x =>
          (x.home.toLowerCase().includes("manchester united") && x.homeWinner === true) ||
          (x.away.toLowerCase().includes("manchester united") && x.awayWinner === true)
        );
        const games = finished.length
          ? finished.map(x => `${x.home} ${x.goalsHome}:${x.goalsAway} ${x.away}`).join(" • ")
          : "Brak rozegranego meczu ligowego";
        return {
          ...base,
          liveText: `${games} • Warunek obecnie: ${unitedWin ? "SPEŁNIONY" : "NIESPEŁNIONY"}`,
          leader: unitedWin ? "Łukaszek" : "Dejv"
        };
      }

      if (b.mode === "player-ga-versus") {
        const a = stats[b.live.a], c = stats[b.live.b];
        if (!a || !c) return { ...base, liveText: "Brak danych zawodnika" };
        return {
          ...base,
          liveText: `${a.name}: ${a.goals}G + ${a.assists}A = ${a.ga} • ${c.name}: ${c.goals}G + ${c.assists}A = ${c.ga}`,
          leader: a.ga > c.ga ? "Pierwszy typ" : c.ga > a.ga ? "Drugi typ" : "Remis"
        };
      }

      if (b.mode === "player-goals-condition") {
        const p = stats[b.live.player];
        if (!p) return { ...base, liveText: "Brak danych zawodnika" };
        return {
          ...base,
          liveText: `${p.name}: ${p.goals}/${b.live.target} goli • ${p.minutes} min`,
          leader: p.goals >= b.live.target ? "Dejv" : "Rudy"
        };
      }

      if (b.mode === "player-ga-sum") {
        const a = stats[b.live.a];
        const bs = b.live.b.map(x => stats[x]);
        if (!a || bs.some(x => !x)) return { ...base, liveText: "Brak danych jednego z zawodników" };
        const totalB = bs.reduce((sum, p) => sum + p.ga, 0);
        return {
          ...base,
          liveText: `${a.name}: ${a.ga} G+A — ${bs.map(p => `${p.name}: ${p.ga}`).join(" + ")} = ${totalB} G+A`,
          leader: a.ga > totalB ? "Rudy" : totalB > a.ga ? "Łukaszek" : "Remis"
        };
      }

      return base;
    });

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      standings,
      results
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: "Dodaj API_FOOTBALL_KEY do .env.local / Vercel Environment Variables."
      },
      { status: 500 }
    );
  }
}
