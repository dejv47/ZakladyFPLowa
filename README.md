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
