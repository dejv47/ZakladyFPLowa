# Zakłady Live — football-data.org

Ta wersja nie używa API-Football. Korzysta z football-data.org.

## Zmienna środowiskowa

W Vercel dodaj:

FOOTBALL_DATA_TOKEN=TWÓJ_TOKEN

Możesz usunąć starą zmienną API_FOOTBALL_KEY — nie jest już używana.

## Co pobieramy automatycznie

Na jedno odświeżenie backend pobiera tylko:
1. aktualną tabelę Premier League,
2. mecze aktualnego sezonu Premier League,
3. listę scorerów Premier League (limit 100).

football-data.org bez parametru `season` zwraca aktualny sezon.

## Ważne

Endpoint `scorers` zwraca ranking scorerów, a nie pełną listę wszystkich zawodników.
Jeżeli na samym początku sezonu zawodnik nie znajduje się jeszcze w tym zestawieniu,
strona może wyświetlić "brak na liście scorerów". Dla zakładu Haaland vs Isak + Gyökeres
brakujący zawodnik jest liczony chwilowo jako 0 G+A.

Zakład Haaland vs Isak z warunkiem minimum 2250 minut nadal wymaga końcowej weryfikacji
minut według Transfermarkt, zgodnie z ustaloną zasadą.

## Deploy

Po wrzuceniu tych plików na GitHub:
1. Vercel automatycznie zrobi deployment.
2. Settings → Environment Variables:
   - dodaj FOOTBALL_DATA_TOKEN,
   - wklej token z football-data.org,
   - Production + Preview.
3. Redeploy.
4. Sprawdź `/api/live`.


## Poprawki v2

- Carrick vs Xabi Alonso = Manchester United vs Chelsea — automatyczne.
- Maresca vs Arteta = Manchester City vs Arsenal — automatyczne.
- De Zerbi top 4 = pozycja Tottenhamu — automatyczne.
- Benjamin Šeško vs Ollie Watkins = G+A we wszystkich rozgrywkach klubowych — poprawione nazwy i zasada; nadal ręczne do czasu podpięcia źródła obejmującego komplet rozgrywek klubowych.
