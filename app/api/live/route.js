import { NextResponse } from "next/server";
import { bets } from "../../../lib/bets";
import {
  getPremierLeagueBundle,
  findStanding,
  findPlayer,
  getManchesterDerbies
} from "../../../lib/footballData";

export const dynamic = "force-dynamic";

function money(n) {
  return `${n.toFixed(2).replace(".", ",")} zł`;
}

function playerText(p) {
  if (!p) return "Brak danych";
  return `${p.name}: ${p.goals}G + ${p.assists}A = ${p.ga} G+A`;
}

export async function GET() {
  try {
    const { standings, matches, scorers } = await getPremierLeagueBundle();
    const derbies = getManchesterDerbies(matches);

    const results = bets.map(b => {
      const base = {
        id: b.id,
        people: b.people,
        title: b.title,
        pick: b.pick,
        amount: money(b.amount),
        note: b.note,
        mode: b.mode,
        manualType: b.manualType ?? null,
        status: "Trwa",
        liveText: "Ręczne rozliczenie",
        leader: null
      };

      if (b.mode === "manual") return base;

      if (b.mode === "standings-condition") {
        const s = findStanding(standings, b.live.team);
        if (!s) return { ...base, liveText: "Brak danych drużyny" };

        let conditionMet = false;
        if (b.live.condition === "outsideTop4") conditionMet = s.rank > 4;
        if (b.live.condition === "top4") conditionMet = s.rank <= 4;

        let leader = null;
        if (b.live.yes && b.live.no) {
          leader = conditionMet ? b.live.yes : b.live.no;
        } else if (b.live.condition === "outsideTop4") {
          leader = conditionMet ? "Pachana" : "Dejv";
        }

        return {
          ...base,
          liveText: `${s.team}: ${s.rank}. miejsce • ${s.points} pkt • ${s.played} meczów`,
          leader
        };
      }

      if (b.mode === "standings-versus") {
        const a = findStanding(standings, b.live.a);
        const c = findStanding(standings, b.live.b);
        if (!a || !c) return { ...base, liveText: "Brak danych drużyny" };
        return {
          ...base,
          liveText: `${a.team}: ${a.rank}. (${a.points} pkt) — ${c.team}: ${c.rank}. (${c.points} pkt)`,
          leader: a.rank < c.rank ? "Pierwszy typ" : c.rank < a.rank ? "Drugi typ" : "Remis"
        };
      }

      if (b.mode === "h2h-win") {
        const finished = derbies.filter(x => x.status === "FINISHED");
        const unitedWin = finished.some(x =>
          (x.home.toLowerCase().includes("manchester united") && x.winner === "HOME_TEAM") ||
          (x.away.toLowerCase().includes("manchester united") && x.winner === "AWAY_TEAM")
        );

        const games = finished.length
          ? finished.map(x => `${x.home} ${x.homeGoals}:${x.awayGoals} ${x.away}`).join(" • ")
          : "Brak rozegranego meczu ligowego";

        return {
          ...base,
          liveText: `${games} • Warunek obecnie: ${unitedWin ? "SPEŁNIONY" : "NIESPEŁNIONY"}`,
          leader: unitedWin ? "Łukaszek" : "Dejv"
        };
      }

      if (b.mode === "player-ga-versus") {
        const a = findPlayer(scorers, b.live.a);
        const c = findPlayer(scorers, b.live.b);

        if (!a || !c) {
          return {
            ...base,
            liveText: `${b.live.a}: ${a ? `${a.ga} G+A` : "brak na liście scorerów"} • ${b.live.b}: ${c ? `${c.ga} G+A` : "brak na liście scorerów"}`
          };
        }

        return {
          ...base,
          liveText: `${playerText(a)} • ${playerText(c)}`,
          leader: a.ga > c.ga ? "Pierwszy typ" : c.ga > a.ga ? "Drugi typ" : "Remis"
        };
      }

      if (b.mode === "player-goals-condition") {
        const p = findPlayer(scorers, b.live.player);
        if (!p) {
          return {
            ...base,
            liveText: `${b.live.player}: brak na liście scorerów (najczęściej oznacza 0 goli na początku sezonu)`
          };
        }

        return {
          ...base,
          liveText: `${p.name}: ${p.goals}/${b.live.target} goli`,
          leader: p.goals >= b.live.target ? "Dejv" : "Rudy"
        };
      }

      if (b.mode === "player-ga-sum") {
        const a = findPlayer(scorers, b.live.a);
        const bs = b.live.b.map(name => ({ name, p: findPlayer(scorers, name) }));

        const gaA = a?.ga ?? 0;
        const totalB = bs.reduce((sum, x) => sum + (x.p?.ga ?? 0), 0);

        return {
          ...base,
          liveText:
            `${a?.name ?? b.live.a}: ${gaA} G+A — ` +
            `${bs.map(x => `${x.p?.name ?? x.name}: ${x.p?.ga ?? 0}`).join(" + ")} = ${totalB} G+A`,
          leader: gaA > totalB ? "Rudy" : totalB > gaA ? "Łukaszek" : "Remis"
        };
      }

      return base;
    });

    return NextResponse.json({
      ok: true,
      provider: "football-data.org",
      updatedAt: new Date().toISOString(),
      standings,
      results
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: "Sprawdź FOOTBALL_DATA_TOKEN w Vercel → Settings → Environment Variables."
      },
      { status: 500 }
    );
  }
}
