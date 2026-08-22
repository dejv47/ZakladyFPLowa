const BASE = "https://api.football-data.org/v4";
const COMPETITION = "PL";
const REVALIDATE_SECONDS = 21600; // 6 godzin

async function api(path) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("Brak FOOTBALL_DATA_TOKEN");

  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Auth-Token": token },
    next: { revalidate: REVALIDATE_SECONDS }
  });

  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}

  if (!res.ok) {
    throw new Error(
      `football-data.org HTTP ${res.status}: ${json.message || text || "Nieznany błąd"}`
    );
  }

  return json;
}

function clean(s = "") {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamAlias(name) {
  const n = clean(name);
  if (n.includes("tottenham")) return "tottenham";
  if (n.includes("bournemouth")) return "bournemouth";
  if (n.includes("liverpool")) return "liverpool";
  if (n.includes("manchester city")) return "manchester city";
  if (n.includes("manchester united")) return "manchester united";
  if (n.includes("chelsea")) return "chelsea";
  if (n.includes("arsenal")) return "arsenal";
  return n;
}

export async function getPremierLeagueBundle() {
  // Brak parametru season = football-data.org bierze aktualny sezon.
  const [standingsJson, matchesJson, scorersJson] = await Promise.all([
    api(`/competitions/${COMPETITION}/standings`),
    api(`/competitions/${COMPETITION}/matches`),
    api(`/competitions/${COMPETITION}/scorers?limit=100`)
  ]);

  const totalStanding =
    standingsJson.standings?.find(s => s.type === "TOTAL") ??
    standingsJson.standings?.[0];

  const standings = (totalStanding?.table ?? []).map(r => ({
    rank: r.position,
    team: r.team?.name ?? "",
    shortName: r.team?.shortName ?? "",
    points: r.points ?? 0,
    played: r.playedGames ?? 0,
    gd: r.goalDifference ?? 0
  }));

  const matches = (matchesJson.matches ?? []).map(m => ({
    id: m.id,
    date: m.utcDate,
    status: m.status,
    home: m.homeTeam?.name ?? "",
    away: m.awayTeam?.name ?? "",
    homeGoals: m.score?.fullTime?.home ?? null,
    awayGoals: m.score?.fullTime?.away ?? null,
    winner: m.score?.winner ?? null
  }));

  const scorers = (scorersJson.scorers ?? []).map(s => ({
    id: s.player?.id,
    name: s.player?.name ?? "",
    firstName: s.player?.firstName ?? "",
    lastName: s.player?.lastName ?? "",
    team: s.team?.name ?? "",
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    ga: (s.goals ?? 0) + (s.assists ?? 0)
  }));

  return { standings, matches, scorers };
}

export function findStanding(standings, query) {
  const q = teamAlias(query);
  return standings.find(s => {
    const full = teamAlias(s.team);
    const short = teamAlias(s.shortName);
    return full.includes(q) || short.includes(q) || q.includes(full) || q.includes(short);
  });
}

export function findPlayer(scorers, query) {
  const q = clean(query);

  // Najpierw dokładne / prawie dokładne dopasowanie.
  let hit = scorers.find(p => {
    const candidates = [p.name, p.firstName, p.lastName].map(clean).filter(Boolean);
    return candidates.some(c => c === q || c.includes(q) || q.includes(c));
  });

  if (hit) return hit;

  // Aliasy pod nasze zakłady.
  const aliases = {
    "erling haaland": ["haaland"],
    "alexander isak": ["isak"],
    "viktor gyokeres": ["gyokeres"],
    "rayan cherki": ["cherki"],
    "morgan gibbswhite": ["gibbswhite", "gibbs white"],
    "bukayo saka": ["saka"]
  };

  const wanted = aliases[q] ?? [q];
  return scorers.find(p => {
    const n = clean(`${p.firstName} ${p.lastName} ${p.name}`);
    return wanted.some(a => n.includes(clean(a)));
  }) ?? null;
}

export function getManchesterDerbies(matches) {
  return matches.filter(m => {
    const home = teamAlias(m.home);
    const away = teamAlias(m.away);
    return (
      (home.includes("manchester united") && away.includes("manchester city")) ||
      (home.includes("manchester city") && away.includes("manchester united"))
    );
  });
}

export async function getPremierLeagueMinutesForPlayer(playerName, scorers = []) {
  // Premier League numeric competition ID in football-data.org.
  const PREMIER_LEAGUE_ID = 2021;
  // Manchester City ID in football-data.org.
  const MAN_CITY_ID = 65;

  // If the player is already in the scorers list, we already know his person ID.
  let player = findPlayer(scorers, playerName);

  // At the start of a season a player with 0 G/A may not yet be on the scorers list,
  // so fall back to the current Manchester City squad.
  if (!player?.id) {
    const teamJson = await api(`/teams/${MAN_CITY_ID}`);
    const q = clean(playerName);

    const squadPlayer = (teamJson.squad ?? []).find(p => {
      const candidates = [p.name, p.firstName, p.lastName]
        .map(clean)
        .filter(Boolean);
      return candidates.some(c => c === q || c.includes(q) || q.includes(c));
    });

    if (!squadPlayer?.id) {
      return null;
    }

    player = {
      id: squadPlayer.id,
      name: squadPlayer.name || playerName
    };
  }

  const matchesJson = await api(
    `/persons/${player.id}/matches?competitions=${PREMIER_LEAGUE_ID}&status=FINISHED&limit=100`
  );

  return {
    id: player.id,
    name: player.name || playerName,
    minutes: matchesJson.aggregations?.minutesPlayed ?? 0,
    matchesOnPitch: matchesJson.aggregations?.matchesOnPitch ?? 0,
    starts: matchesJson.aggregations?.startingXI ?? 0
  };
}
