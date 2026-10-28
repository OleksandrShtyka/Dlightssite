-- Run this in Supabase SQL Editor before connecting the web or Android client.
create table if not exists public.account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.account_settings enable row level security;
revoke all on table public.account_settings from anon;
grant select, insert, update, delete on table public.account_settings to authenticated;

drop policy if exists "Users can read own settings" on public.account_settings;
create policy "Users can read own settings" on public.account_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own settings" on public.account_settings;
create policy "Users can insert own settings" on public.account_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own settings" on public.account_settings;
create policy "Users can update own settings" on public.account_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own settings" on public.account_settings;
create policy "Users can delete own settings" on public.account_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- The Kadr movie diary is isolated from DTEK settings in its own per-user row.
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

-- Fitness tracker cloud data. Uses the same Supabase project as DTEK and Kadr,
-- while keeping the application's payload isolated in its own per-user row.
create table if not exists public.fitness_tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"profile":{},"sessions":[],"supplements":[],"local":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.fitness_tracker_data enable row level security;
revoke all on table public.fitness_tracker_data from anon;
grant select, insert, update, delete on public.fitness_tracker_data to authenticated;

drop policy if exists "Users can read own fitness tracker data" on public.fitness_tracker_data;
create policy "Users can read own fitness tracker data" on public.fitness_tracker_data
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own fitness tracker data" on public.fitness_tracker_data;
create policy "Users can insert own fitness tracker data" on public.fitness_tracker_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own fitness tracker data" on public.fitness_tracker_data;
create policy "Users can update own fitness tracker data" on public.fitness_tracker_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own fitness tracker data" on public.fitness_tracker_data;
create policy "Users can delete own fitness tracker data" on public.fitness_tracker_data
  for delete to authenticated using ((select auth.uid()) = user_id);
