export const bets = [
  {
    id: 1,
    people: "Dejv i Pachana",
    title: "Man City skończą poza top 4",
    pick: "Pachana: TAK • Dejv: NIE",
    amount: 50,
    note: "",
    mode: "standings-condition",
    live: { team: "Manchester City", condition: "outsideTop4" }
  },
  {
    id: 2,
    people: "Dejv i Łukaszek",
    title: "Manchester United wygra przynajmniej 1 mecz w lidze z Man City",
    pick: "Łukaszek: TAK • Dejv: NIE",
    amount: 50,
    note: "",
    mode: "h2h-win",
    live: { teamA: "Manchester United", teamB: "Manchester City", winner: "Manchester United" }
  },
  {
    id: 3,
    people: "Dejv i Łukaszek",
    title: "Kto wyżej w tabeli",
    pick: "Dejv: Tottenham • Łukasz: Liverpool",
    amount: 50,
    note: "",
    mode: "standings-versus",
    live: { a: "Tottenham", b: "Liverpool" }
  },
  {
    id: 4,
    people: "Pachana i Łukaszek",
    title: "Resovia awansuje w sezonie 26/27 do pierwszej ligi",
    pick: "Pachana: NIE • Łukasz: TAK",
    amount: 200,
    note: "",
    mode: "manual",
    manualType: "resovia"
  },
  {
    id: 5,
    people: "Dejv i Łukaszek",
    title: "Kanadyjka w lidze",
    pick: "Dejv: Haaland • Łukasz: Isak",
    amount: 50,
    note: "Sama liga G/A liczone z Transfermarkt, minimum 2250 minut w lidze",
    mode: "player-ga-versus",
    live: { a: "Erling Haaland", b: "Alexander Isak" }
  },
  {
    id: 6,
    people: "Dejv i Janek",
    title: "Kanadyjka w lidze",
    pick: "Dejv: Rayan Cherki • Janek: Morgan Gibbs-White",
    amount: 50,
    note: "",
    mode: "player-ga-versus",
    live: { a: "Rayan Cherki", b: "Morgan Gibbs-White" }
  },
  {
    id: 7,
    people: "Dejv i Janek",
    title: "Kto wyżej w lidze",
    pick: "Janek: Carrick (Manchester United) • Dejv: Xabi Alonso (Chelsea)",
    amount: 50,
    note: "",
    mode: "standings-versus",
    live: { a: "Manchester United", b: "Chelsea" }
  },
  {
    id: 8,
    people: "Dejv i Janek",
    title: "Kto wyżej w lidze",
    pick: "Dejv: Tottenham • Janek: Bournemouth",
    amount: 50,
    note: "",
    mode: "standings-versus",
    live: { a: "Tottenham", b: "Bournemouth" }
  },
  {
    id: 9,
    people: "Dejv i big bob",
    title: "Kto wyżej w lidze",
    pick: "Dejv: Maresca (Manchester City) • Bob: Arteta (Arsenal)",
    amount: 50,
    note: "Jak któregoś wyjebią wcześniej to się anuluje.",
    mode: "standings-versus",
    live: { a: "Manchester City", b: "Arsenal" }
  },
  {
    id: 10,
    people: "Dejv i kuchnia",
    title: "Kanadyjka — wszystkie rozgrywki klubowe",
    pick: "Dejv: Benjamin Šeško • Kuchnia: Ollie Watkins",
    amount: 50,
    note: "Liczymy G+A we wszystkich rozgrywkach klubowych.",
    mode: "manual",
    manualType: "sesko-watkins"
  },
  {
    id: 11,
    people: "Dejv i big bob",
    title: "Kanadyjka w lidze",
    pick: "Dejv: Cherki • Bob: Saka",
    amount: 50,
    note: "",
    mode: "player-ga-versus",
    live: { a: "Rayan Cherki", b: "Bukayo Saka" }
  },
  {
    id: 12,
    people: "Dejv i Radek",
    title: "Kto więcej pkt w FPL w 1 kolejce",
    pick: "Dejv vs Radek",
    amount: 30,
    note: "",
    mode: "manual",
    manualType: "fpl"
  },
  {
    id: 13,
    people: "Dejv i Rudy",
    title: "Haaland wpierdoli minimum 30 bramek w lidze",
    pick: "Dejv: TAK • Rudy: NIE",
    amount: 50,
    note: "",
    mode: "player-goals-condition",
    live: { player: "Erling Haaland", target: 30 }
  },
  {
    id: 14,
    people: "Dejv i Rudy",
    title: "De Zerbi skończy w top 4",
    pick: "Dejv: TAK • Rudy: NIE",
    amount: 50,
    note: "Zakład rozliczany na podstawie pozycji Tottenhamu w Premier League.",
    mode: "standings-condition",
    live: { team: "Tottenham", condition: "top4", yes: "Dejv", no: "Rudy" }
  },
  {
    id: 15,
    people: "Rudy i Łukaszek",
    title: "Kanadyjka w sezonie",
    pick: "Rudy: Haaland • Łukaszek: Isak + Gyökeres",
    amount: 50,
    note: "Jak Gyökeres wypierdoli to anulowane. Domyślnie liczone jako ligowe G+A.",
    mode: "player-ga-sum",
    live: { a: "Erling Haaland", b: ["Alexander Isak", "Viktor Gyokeres"] }
  }
];
