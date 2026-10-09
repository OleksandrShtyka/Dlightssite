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

