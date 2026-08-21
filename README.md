# Zakłady Live

Gotowa strona pod Next.js + Vercel z 15 zakładami.

## Co działa automatycznie

Po dodaniu klucza API-Football:
- tabela Premier League 2026/27,
- Man City poza / w top 4,
- Tottenham vs Liverpool,
- Tottenham vs Bournemouth,
- Manchester United vs Manchester City (czy United wygrał któryś ligowy mecz),
- G+A Haaland vs Isak,
- G+A Cherki vs Gibbs-White,
- G+A Cherki vs Saka,
- gole Haalanda vs próg 30,
- Haaland G+A vs Isak + Gyökeres G+A.

Dane są cache'owane na 6 godzin, żeby nie przepalać darmowego limitu API.

## Zakłady wymagające doprecyzowania / ręczne

- Resovia — awans,
- Carrick vs Xabi Alonso — trzeba wskazać kluby,
- Maresca vs Arteta/Bordelas — trzeba wskazać kluby,
- Šeško vs Watkins wszystkie rozgrywki — trzeba ustalić jedno źródło wszystkich rozgrywek,
- FPL kolejka 1 — trzeba wskazać zawodników,
- De Zerbi top 4 — trzeba wskazać klub.

## Uruchomienie lokalnie

1. Zainstaluj Node.js 20+.
2. W katalogu projektu:
   npm install
3. Skopiuj:
   .env.example -> .env.local
4. Załóż darmowe konto API-Football i wpisz:
   API_FOOTBALL_KEY=TWÓJ_KLUCZ
5. Uruchom:
   npm run dev
6. Otwórz:
   http://localhost:3000

## Publikacja na Vercel

1. Wrzuć projekt na GitHub.
2. Na Vercel wybierz "Add New Project" i repozytorium.
3. W Project Settings -> Environment Variables dodaj:
   API_FOOTBALL_KEY
4. Deploy.

Nie używaj nazwy NEXT_PUBLIC_API_FOOTBALL_KEY — klucz ma zostać wyłącznie po stronie serwera.
