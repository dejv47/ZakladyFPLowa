create table if not exists public.manual_bets (
  bet_id integer primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.manual_bets enable row level security;

drop policy if exists "Public read manual bets" on public.manual_bets;
create policy "Public read manual bets"
on public.manual_bets
for select
to anon
using (true);

drop policy if exists "Public insert manual bets" on public.manual_bets;
create policy "Public insert manual bets"
on public.manual_bets
for insert
to anon
with check (true);

drop policy if exists "Public update manual bets" on public.manual_bets;
create policy "Public update manual bets"
on public.manual_bets
for update
to anon
using (true)
with check (true);
