-- Run this script in Supabase SQL Editor.
-- It creates a single shared state row used by the admin panel.

create table if not exists public.app_state (
  id text primary key,
  settings jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

insert into public.app_state (id, settings, items)
values (
  'global',
  '{"siteEnabled": true, "showAR": true, "showGames": true}'::jsonb,
  '[]'::jsonb
)
on conflict (id) do nothing;

alter table public.app_state enable row level security;
alter table public.admin_users enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table public.app_state to anon, authenticated;
grant insert, update on table public.app_state to authenticated;
grant select on table public.admin_users to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- NOTE: Add admin rows manually after creating a Supabase Auth user.
-- Example:
-- insert into public.admin_users (user_id, email)
-- select id, email from auth.users where email = 'admin@chi5a.tn';

drop policy if exists "Allow read app_state" on public.app_state;
create policy "Allow read app_state"
on public.app_state
for select
to anon
using (true);

drop policy if exists "Allow read app_state authenticated" on public.app_state;
create policy "Allow read app_state authenticated"
on public.app_state
for select
to authenticated
using (true);

drop policy if exists "Allow write app_state" on public.app_state;
create policy "Allow write app_state"
on public.app_state
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Allow update app_state" on public.app_state;
create policy "Allow update app_state"
on public.app_state
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Allow admin_users self read" on public.admin_users;
create policy "Allow admin_users self read"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());
