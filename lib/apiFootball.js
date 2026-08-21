const BASE = "https://v3.football.api-sports.io";
const LEAGUE_ID = 39; // Premier League
const SEASON = 2026;
const REVALIDATE_SECONDS = 21600; // 6h - oszczędza darmowy limit API

async function api(path) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("Brak API_FOOTBALL_KEY");

  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key },
    next: { revalidate: REVALIDATE_SECONDS }
  });

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`API-Football: ${JSON.stringify(json.errors)}`);
  }
  return json.response ?? [];
}

function normalizeTeamName(name) {
  const n = name.toLowerCase();
  if (n.includes("tottenham")) return "tottenham";
  if (n.includes("bournemouth")) return "bournemouth";
  if (n.includes("liverpool")) return "liverpool";
  if (n.includes("manchester city")) return "manchester city";
  if (n.includes("manchester united")) return "manchester united";
  return n;
}

export async function getPremierLeagueStandings() {
  const response = await api(`/standings?league=${LEAGUE_ID}&season=${SEASON}`);
  const rows = response?.[0]?.league?.standings?.[0] ?? [];
  return rows.map(r => ({
    rank: r.rank,
    team: r.team.name,
    points: r.points,
    played: r.all.play,
    gd: r.goalsDiff
  }));
}

export async function getPlayerStats(search) {
  const encoded = encodeURIComponent(search);
  const response = await api(`/players?search=${encoded}&league=${LEAGUE_ID}&season=${SEASON}`);

  // Prefer the first Premier League stat row with minutes / appearances.
  const item = response?.[0];
  if (!item) return null;

  const stat = item.statistics?.find(s => s.league?.id === LEAGUE_ID) ?? item.statistics?.[0];
  if (!stat) return null;

  return {
    name: item.player.name,
    goals: stat.goals?.total ?? 0,
    assists: stat.goals?.assists ?? 0,
    ga: (stat.goals?.total ?? 0) + (stat.goals?.assists ?? 0),
    minutes: stat.games?.minutes ?? 0,
    appearances: stat.games?.appearences ?? 0,
    team: stat.team?.name ?? ""
  };
}

export async function getManchesterDerbies() {
  // API-Football team IDs: discovered dynamically by league search is expensive;
  // use head-to-head IDs commonly stable in API-Football: Man Utd 33, Man City 50.
  const response = await api(`/fixtures/headtohead?h2h=33-50&league=${LEAGUE_ID}&season=${SEASON}`);
  return response.map(f => ({
    date: f.fixture.date,
    status: f.fixture.status.short,
    home: f.teams.home.name,
    away: f.teams.away.name,
    homeWinner: f.teams.home.winner,
    awayWinner: f.teams.away.winner,
    goalsHome: f.goals.home,
    goalsAway: f.goals.away
  }));
}

export function findStanding(standings, query) {
  const q = normalizeTeamName(query);
  return standings.find(s => normalizeTeamName(s.team).includes(q));
}
