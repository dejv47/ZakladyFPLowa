# Zakłady Live v3

Wersja z publiczną edycją 3 ręcznych zakładów:
- Resovia — status awansu,
- Benjamin Šeško vs Ollie Watkins — gole i asysty,
- FPL Dejv vs Radek — punkty.

Zmiany są zapisywane w Supabase i widoczne dla wszystkich.

## 1. football-data.org

Vercel Environment Variable:
FOOTBALL_DATA_TOKEN

## 2. Supabase

Załóż darmowy projekt na supabase.com.

W Supabase:
1. SQL Editor
2. New query
3. Wklej całą zawartość `SUPABASE_SETUP.sql`
4. Run

Potem w Project Settings / API skopiuj:
- Project URL
- anon / publishable key

W Vercel dodaj:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

Po dodaniu zmiennych zrób Redeploy.

## Ważne

Ta konfiguracja celowo pozwala każdemu odwiedzającemu stronę edytować ręczne wyniki.
Nie ma logowania ani hasła, zgodnie z założeniem projektu.


## v4 — ochrona przed starą wersją z cache

- główna strona ma `Cache-Control: no-store`,
- `/api/live` ma `Cache-Control: no-store`,
- frontend dodaje `?t=<timestamp>` do każdego pobrania danych,
- request do danych live ma timeout 10 sekund,
- po nowym deploymencie zwykłe odświeżenie powinno wystarczyć zamiast Ctrl+F5.


## v6 — automatyczne minuty Cherkiego

Zakład „Rayan Cherki minimum 2000 minut w Premier League” jest teraz automatyczny.
Backend pobiera osobę z kadry Manchesteru City, a następnie korzysta z
`/persons/{id}/matches?competitions=2021&status=FINISHED` i odczytuje
`aggregations.minutesPlayed`.


## v13 — FPL live points fix
- Punkty zawodników do artykułów są pobierane z `/event/{GW}/live/`.
- Nie używamy już `bootstrap-static.event_points` do bieżącej kolejki.
- Wynik GW drużyny jest liczony ze składu live minus koszt transferów.


## v14 — oficjalne wyniki FPL i mocniejsza satyra
- GW points = `entry_history.points`
- Overall = `entry_history.total_points`
- Punkty konkretnych zawodników nadal z `/event/{GW}/live/`
- Po zakończeniu GW artykuły korzystają z finalnych danych tej kolejki.
- Mocniej satyryczne teksty zależne od realnych składów, kapitanów, ławki i transferów.


## v15 — wyniki dokładnie z tabeli Waszej ligi FPL
- GW = `league.standings.results[].event_total`
- Overall = `league.standings.results[].total`
- Punkty konkretnych zawodników nadal z oficjalnego `/event/{GW}/live/`.
- Zakładka FPL odświeża się automatycznie co 5 minut i po powrocie do karty.
- Po zakończeniu GW nagłówek przechodzi na `WYDANIE KOŃCOWE`, a teksty korzystają z finalnych danych.


## v16 — punkty tylko po rozpoczęciu realnego meczu
- Pobieramy `/fixtures/?event={GW}`.
- Jeśli klub zawodnika jeszcze nie rozpoczął meczu, zawodnik ma w artykułach 0 punktów i status `jeszcze nie grał`.
- Bohater/najgorszy zawodnik wybierany jest tylko spośród graczy, których spotkanie faktycznie się rozpoczęło.
- Zapobiega to tekstom typu „Garnacho 30 pkt” przed jego meczem.
