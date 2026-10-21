create table if not exists public.movie_diaries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"entries":[],"deletedIds":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.movie_diaries enable row level security;
revoke all on table public.movie_diaries from anon;
grant select, insert, update, delete on table public.movie_diaries to authenticated;

drop policy if exists "Users can read own movie diary" on public.movie_diaries;
create policy "Users can read own movie diary" on public.movie_diaries
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own movie diary" on public.movie_diaries;
create policy "Users can insert own movie diary" on public.movie_diaries
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own movie diary" on public.movie_diaries;
create policy "Users can update own movie diary" on public.movie_diaries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own movie diary" on public.movie_diaries;
create policy "Users can delete own movie diary" on public.movie_diaries
  for delete to authenticated using ((select auth.uid()) = user_id);
