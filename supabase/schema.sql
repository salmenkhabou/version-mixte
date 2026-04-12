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

create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cafe_orders (
  id bigint generated always as identity primary key,
  table_number text not null,
  customer_name text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'preparing', 'served', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, settings, items)
values (
  'global',
  '{"siteEnabled": true, "showAR": true, "showGames": true, "showOrdersModule": true}'::jsonb,
  '[]'::jsonb
)
on conflict (id) do nothing;

update public.app_state
set settings = '{"siteEnabled": true, "showAR": true, "showGames": true, "showOrdersModule": true}'::jsonb || settings
where id = 'global';

alter table public.app_state enable row level security;
alter table public.admin_users enable row level security;
alter table public.staff_users enable row level security;
alter table public.cafe_orders enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table public.app_state to anon, authenticated;
grant insert, update on table public.app_state to authenticated;
grant select on table public.admin_users to authenticated;
grant select on table public.staff_users to authenticated;
grant select, insert on table public.cafe_orders to anon, authenticated;
grant update on table public.cafe_orders to authenticated;

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

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users
    where user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_staff();
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.can_manage_orders() from public;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.can_manage_orders() to anon, authenticated;

-- NOTE: Add admin/staff rows manually after creating Supabase Auth users.
-- Example:
-- insert into public.admin_users (user_id, email)
-- select id, email from auth.users where email = 'admin@chi5a.tn';
-- insert into public.staff_users (user_id, email)
-- select id, email from auth.users where email = 'serveur@chi5a.tn';

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

drop policy if exists "Allow staff_users self read" on public.staff_users;
create policy "Allow staff_users self read"
on public.staff_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Allow create cafe orders" on public.cafe_orders;
create policy "Allow create cafe orders"
on public.cafe_orders
for insert
to anon, authenticated
with check (
  length(trim(coalesce(table_number, ''))) > 0
);

drop policy if exists "Allow read cafe orders by staff" on public.cafe_orders;
create policy "Allow read cafe orders by staff"
on public.cafe_orders
for select
to authenticated
using (public.can_manage_orders());

drop policy if exists "Allow update cafe orders by staff" on public.cafe_orders;
create policy "Allow update cafe orders by staff"
on public.cafe_orders
for update
to authenticated
using (public.can_manage_orders())
with check (public.can_manage_orders());

do $$
begin
  alter publication supabase_realtime add table public.cafe_orders;
exception
  when duplicate_object then
    null;
end $$;
