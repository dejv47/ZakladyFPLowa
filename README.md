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

## v18 — dynamiczna FPLowa TOP 10
Dodano pulę kategorii: Frajer kolejki, Transfer z dupy/Prokuratura FPL, 200 IQ,
Ławkowy Guardiola, Kapitan debil, Owca kolejki, Differential Chad, Jednoosobowa armia,
Pasożyty kolejki, Szpital polowy, Financial Fair Play, Z chuja do bohatera,
Titanic Award, Największy pechowiec, Farciarz jebany, Derby FPLowej,
Power Ranking oraz dotychczasowe najlepszy/najgorszy wynik.
Każda kategoria dostaje relevance score; publikowane jest tylko 10 najwyżej ocenionych.


## v19 — tryb chamskiego brukowca
- Znacznie większe banki tekstów i obelg.
- Mocniejsze przekleństwa i bezpośrednie roastowanie decyzji menedżerów.
- Warianty zmieniają się między GW, żeby gazeta nie waliła w kółko tym samym tekstem.
- Nadal publikowane jest maksymalnie 10 najbardziej trafnych kategorii.
- Dane punktowe pozostają oddzielone od warstwy satyrycznej.

## v20 — żarty z nazw drużyn
- Silnik wykrywa fragmenty nazw fantasy teamów i dokłada tematyczne punchline'y.
- Specjalne warianty m.in. dla nazw zawierających Man Cioty/cioty, City, United, Liverpool,
  Arsenal, Spurs/Tottenham, Chelsea, Villa, Real i FC.
- Każdy klub ma też dużą pulę uniwersalnych roastów.
- Punchline'y są mieszane z istniejącymi bankami tekstów zależnie od GW i kategorii,
  więc artykuły są znacznie bardziej zróżnicowane.


## v56 — ważne dla ręcznej edycji
Jeżeli strona była wdrożona przed dodaniem ręcznych wyników/statusów, uruchom ponownie CAŁY plik `SUPABASE_SETUP.sql`
w Supabase -> SQL Editor. Plik tworzy/odświeża polityki INSERT/UPDATE oraz granty potrzebne do zapisu z aplikacji.
v56 pokazuje też prawdziwy komunikat błędu Supabase zamiast maskować go komunikatem `TypeError: fetch failed`.

Status zakładu nie jest już trzema wzajemnie wykluczającymi się stanami. Każdy zakład pozostaje zakładem aktywnym,
a osobno ustawiasz `ROZLICZONY? TAK/NIE` i `ANULOWANY? TAK/NIE`. Rozliczone lub anulowane nie wchodzą do salda.

## v58 — zapis manualny / diagnostyka
Jeżeli zapis nadal nie działa, otwórz po deployu `/api/manual-bets/health`.
`ok` musi być `true`, `supabaseHost` musi wskazywać host projektu Supabase.
Backend akceptuje `SUPABASE_URL` lub `NEXT_PUBLIC_SUPABASE_URL`; opcjonalnie można podać samo `SUPABASE_PROJECT_REF`.
Do autoryzacji preferowany jest `SUPABASE_SERVICE_ROLE_KEY`, a fallback to `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Błąd zapisu pokazuje teraz kod niskopoziomowy (np. ENOTFOUND/ECONNRESET), żeby nie zgadywać przy kolejnym problemie.

## v59 — ręczne zakłady bez Supabase
Ręczne wyniki, rozliczenie i anulowanie są zapisywane wyłącznie w localStorage przeglądarki.
Ta funkcja nie wykonuje żadnego requestu do Supabase ani `/api/manual-bets`.
`ROZLICZONY?` ma jeden przycisk TAK; ponowne kliknięcie cofa rozliczenie.
`ANULUJ ZAKŁAD` oznacza zakład jako anulowany i wyłącza go z salda.

## v60 — wspólne ręczne wyniki/statusy dla wszystkich
Ręczne wyniki, `ROZLICZONY? TAK` i `ANULUJ ZAKŁAD` są wspólne dla wszystkich przeglądarek.
Nie używamy Supabase. Backend korzysta z Vercel KV / Upstash Redis przez REST.

Konfiguracja na Vercel:
1. Project -> Storage / Marketplace -> dodaj Upstash Redis (KV) do tego projektu.
2. Vercel automatycznie doda zmienne. Kod obsługuje zarówno:
   - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
3. Zrób Redeploy.
4. `/api/manual-state/health` powinno zwrócić `{"ok":true,"hasUrl":true,"hasToken":true}`.

localStorage pozostaje tylko cache/fallbackiem do odczytu. Zapis jest uznany za udany dopiero po zapisie we wspólnym KV.

## v61
Etykieta `Prowadzi:` pokazuje nick gracza zamiast technicznego `Pierwszy typ` / `Drugi typ`.

## v62
Naprawa crasha v61: mapa właścicieli typów jest współdzielona poza komponentem; nick prowadzącego renderuje się bez ReferenceError.

## v63
Naprawa React #130: przywrócony named export `BetsTab`, którego `app/fpl/page.js` używa jako `<BetsTab />`.

## v64
Naprawione saldo: ręczny zakład Resovii wyznacza lidera z ustawionego statusu, a techniczne `Pierwszy typ`/`Drugi typ` są mapowane dynamicznie z pola TYPY zamiast z niepełnej listy ID. Zakłady #22 i #23 są dzięki temu doliczane do bilansu Dejv–San Kory.

## v65
Naprawione dopasowanie zawodników: Morgan Gibbs-White nie może już zostać pomylony z Morganem Rogersem przez wspólne imię `Morgan`. Zakład #6 liczy G+A Gibbs-White'a.

## v66
Zakład #16: minuty Cherkiego są edytowane ręcznie i zapisywane we wspólnym KV; prowadzący liczy się automatycznie względem 2000 minut.
