create table if not exists public.manual_bets (
  bet_id integer primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.manual_bets enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on table public.manual_bets to anon, authenticated, service_role;

drop policy if exists "Public read manual bets" on public.manual_bets;
drop policy if exists "Public insert manual bets" on public.manual_bets;
drop policy if exists "Public update manual bets" on public.manual_bets;

create policy "Public read manual bets"
on public.manual_bets for select
to anon, authenticated
using (true);

create policy "Public insert manual bets"
on public.manual_bets for insert
to anon, authenticated
with check (true);

create policy "Public update manual bets"
on public.manual_bets for update
to anon, authenticated
using (true)
with check (true);
