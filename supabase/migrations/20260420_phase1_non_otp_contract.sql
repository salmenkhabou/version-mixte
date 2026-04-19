-- Phase 1 completion (non-OTP scope):
-- - Required entities: organizations, branches, users, user_profiles,
--   roles, permissions, role_permissions, user_branch_access,
--   devices, notification_tokens, sync_queue, audit_logs.
-- - Keeps backward compatibility with existing ERP tables and flows.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations (code, name, is_active)
values ('CORE', 'Core Organization', true)
on conflict (code) do nothing;

alter table public.erp_branches
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

update public.erp_branches
set organization_id = (
  select id
  from public.organizations
  order by created_at asc
  limit 1
)
where organization_id is null;

drop view if exists public.branches;
create view public.branches as
select
  b.id,
  b.organization_id,
  b.code,
  b.name,
  b.timezone,
  b.is_active,
  b.created_at,
  b.updated_at
from public.erp_branches b;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role_key text not null default 'guest',
  organization_id uuid references public.organizations(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  default_branch_id text references public.erp_branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  key text primary key,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.user_branch_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id text not null references public.erp_branches(id) on delete cascade,
  role_key text not null references public.roles(key) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create table if not exists public.devices (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  branch_id text references public.erp_branches(id) on delete set null,
  platform text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  branch_id text references public.erp_branches(id) on delete set null,
  operation_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  priority smallint not null default 5,
  retries integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_role_key on public.users (role_key);
create index if not exists idx_user_profiles_default_branch on public.user_profiles (default_branch_id);
create index if not exists idx_user_branch_access_branch on public.user_branch_access (branch_id);
create index if not exists idx_user_branch_access_role on public.user_branch_access (role_key);
create index if not exists idx_devices_user_id on public.devices (user_id);
create index if not exists idx_devices_branch_id on public.devices (branch_id);
create index if not exists idx_sync_queue_user_status_created on public.sync_queue (user_id, status, created_at desc);
create index if not exists idx_sync_queue_branch_status_created on public.sync_queue (branch_id, status, created_at desc);
create index if not exists idx_audit_logs_actor_created on public.audit_logs (actor_user_id, created_at desc);
create index if not exists idx_audit_logs_action_created on public.audit_logs (action, created_at desc);

insert into public.roles (key, label, description)
values
  ('guest', 'Guest', 'Public/unauthenticated base role'),
  ('staff', 'Staff', 'Operational staff role'),
  ('manager', 'Manager', 'Branch/operations manager role'),
  ('admin', 'Admin', 'Platform administrator role')
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description;

insert into public.permissions (key, description)
values
  ('customer.order.create', 'Create customer order'),
  ('customer.order.track', 'Track customer order status'),
  ('orders.staff.view', 'View staff orders dashboard'),
  ('orders.staff.update_status', 'Update order status as staff'),
  ('orders.staff.assign', 'Assign order to staff'),
  ('orders.manager.view', 'View manager orders dashboard'),
  ('orders.manager.analytics', 'View manager analytics'),
  ('orders.manager.export', 'Export manager reports'),
  ('orders.manager.cash_closure', 'Manage cash closure operations'),
  ('orders.manager.staff_manage', 'Manage staff membership from manager interface'),
  ('admin.panel.view', 'View admin panel'),
  ('admin.settings.write', 'Modify admin settings'),
  ('admin.articles.write', 'Modify product/articles list'),
  ('admin.staff.manage', 'Manage staff from admin panel'),
  ('branches.view', 'View branches'),
  ('branches.manage', 'Create/update/delete branches'),
  ('notifications.manage', 'Manage push notifications setup'),
  ('notifications.publish', 'Publish server-side notifications'),
  ('offline.sync', 'Run offline queue sync actions'),
  ('erp.control.view', 'View ERP control center')
on conflict (key) do update
set
  description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('guest', 'customer.order.create'),
  ('guest', 'customer.order.track'),

  ('staff', 'customer.order.create'),
  ('staff', 'customer.order.track'),
  ('staff', 'orders.staff.view'),
  ('staff', 'orders.staff.update_status'),
  ('staff', 'orders.staff.assign'),
  ('staff', 'branches.view'),
  ('staff', 'notifications.manage'),
  ('staff', 'offline.sync'),
  ('staff', 'erp.control.view'),

  ('manager', 'customer.order.create'),
  ('manager', 'customer.order.track'),
  ('manager', 'orders.staff.view'),
  ('manager', 'orders.staff.update_status'),
  ('manager', 'orders.staff.assign'),
  ('manager', 'orders.manager.view'),
  ('manager', 'orders.manager.analytics'),
  ('manager', 'orders.manager.export'),
  ('manager', 'orders.manager.cash_closure'),
  ('manager', 'orders.manager.staff_manage'),
  ('manager', 'branches.view'),
  ('manager', 'branches.manage'),
  ('manager', 'notifications.manage'),
  ('manager', 'notifications.publish'),
  ('manager', 'offline.sync'),
  ('manager', 'erp.control.view')
on conflict (role_key, permission_key) do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'admin', p.key
from public.permissions p
on conflict (role_key, permission_key) do nothing;

insert into public.users (id, email, role_key, organization_id, is_active)
select
  au.id,
  lower(coalesce(au.email, concat('user-', au.id::text, '@unknown.local'))),
  'guest',
  (select id from public.organizations order by created_at asc limit 1),
  true
from auth.users au
on conflict (id) do update
set
  email = excluded.email,
  updated_at = now();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'admin_users'
  ) then
    insert into public.users (id, email, role_key, organization_id, is_active)
    select
      a.user_id,
      lower(coalesce(a.email, concat('admin-', a.user_id::text, '@unknown.local'))),
      'admin',
      (select id from public.organizations order by created_at asc limit 1),
      true
    from public.admin_users a
    on conflict (id) do update
    set
      email = excluded.email,
      role_key = 'admin',
      updated_at = now();
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'staff_users'
  ) then
    insert into public.users (id, email, role_key, organization_id, is_active)
    select
      s.user_id,
      lower(coalesce(s.email, concat('staff-', s.user_id::text, '@unknown.local'))),
      case
        when lower(coalesce(s.role, 'staff')) = 'manager' then 'manager'
        else 'staff'
      end,
      (select id from public.organizations order by created_at asc limit 1),
      true
    from public.staff_users s
    on conflict (id) do update
    set
      email = excluded.email,
      role_key = case
        when public.users.role_key = 'admin' then public.users.role_key
        else excluded.role_key
      end,
      updated_at = now();
  end if;
end
$$;

insert into public.user_profiles (user_id)
select u.id
from public.users u
on conflict (user_id) do nothing;

insert into public.user_branch_access (user_id, branch_id, role_key, is_default)
select
  u.id,
  'main',
  case
    when u.role_key in ('admin', 'manager', 'staff') then u.role_key
    else 'staff'
  end,
  true
from public.users u
where u.role_key in ('admin', 'manager', 'staff')
on conflict (user_id, branch_id) do update
set
  role_key = excluded.role_key,
  is_default = public.user_branch_access.is_default or excluded.is_default;

insert into public.devices (id, user_id, branch_id, platform, user_agent, last_seen_at, created_at, updated_at)
select
  nt.device_id,
  nt.user_id,
  nt.branch_id,
  nt.platform,
  nt.user_agent,
  now(),
  coalesce(nt.created_at, now()),
  coalesce(nt.updated_at, now())
from public.notification_tokens nt
where nt.device_id is not null
on conflict (id) do update
set
  user_id = excluded.user_id,
  branch_id = excluded.branch_id,
  platform = excluded.platform,
  user_agent = excluded.user_agent,
  last_seen_at = now(),
  updated_at = now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_tokens_device_id_fkey'
      and conrelid = 'public.notification_tokens'::regclass
  ) then
    alter table public.notification_tokens
      add constraint notification_tokens_device_id_fkey
      foreign key (device_id)
      references public.devices(id)
      on delete cascade;
  end if;
end
$$;

create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_organizations_set_updated_at') then
    create trigger trg_organizations_set_updated_at
    before update on public.organizations
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_users_set_updated_at') then
    create trigger trg_users_set_updated_at
    before update on public.users
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_user_profiles_set_updated_at') then
    create trigger trg_user_profiles_set_updated_at
    before update on public.user_profiles
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_devices_set_updated_at') then
    create trigger trg_devices_set_updated_at
    before update on public.devices
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_sync_queue_set_updated_at') then
    create trigger trg_sync_queue_set_updated_at
    before update on public.sync_queue
    for each row execute function public.app_set_updated_at();
  end if;
end
$$;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_branch_access enable row level security;
alter table public.devices enable row level security;
alter table public.sync_queue enable row level security;
alter table public.audit_logs enable row level security;

grant select on public.organizations to authenticated;
grant select on public.branches to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;
grant select, insert, update, delete on public.user_branch_access to authenticated;
grant select, insert, update on public.devices to authenticated;
grant select, insert, update on public.sync_queue to authenticated;
grant select, insert on public.audit_logs to authenticated;

drop policy if exists "Authenticated read organizations" on public.organizations;
create policy "Authenticated read organizations"
on public.organizations
for select
to authenticated
using (true);

drop policy if exists "Users read self" on public.users;
create policy "Users read self"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users insert self" on public.users;
create policy "Users insert self"
on public.users
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users update self" on public.users;
create policy "Users update self"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Profiles read self" on public.user_profiles;
create policy "Profiles read self"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Profiles insert self" on public.user_profiles;
create policy "Profiles insert self"
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Profiles update self" on public.user_profiles;
create policy "Profiles update self"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Read roles" on public.roles;
create policy "Read roles"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "Read permissions" on public.permissions;
create policy "Read permissions"
on public.permissions
for select
to authenticated
using (true);

drop policy if exists "Read role permissions" on public.role_permissions;
create policy "Read role permissions"
on public.role_permissions
for select
to authenticated
using (true);

drop policy if exists "Read own branch access" on public.user_branch_access;
create policy "Read own branch access"
on public.user_branch_access
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Manage own branch access" on public.user_branch_access;
create policy "Manage own branch access"
on public.user_branch_access
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Read own devices" on public.devices;
create policy "Read own devices"
on public.devices
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Manage own devices" on public.devices;
create policy "Manage own devices"
on public.devices
for all
to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Read own sync queue" on public.sync_queue;
create policy "Read own sync queue"
on public.sync_queue
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Insert own sync queue" on public.sync_queue;
create policy "Insert own sync queue"
on public.sync_queue
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Update own sync queue" on public.sync_queue;
create policy "Update own sync queue"
on public.sync_queue
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Read own audit logs" on public.audit_logs;
create policy "Read own audit logs"
on public.audit_logs
for select
to authenticated
using (actor_user_id = auth.uid());

drop policy if exists "Insert own audit logs" on public.audit_logs;
create policy "Insert own audit logs"
on public.audit_logs
for insert
to authenticated
with check (actor_user_id = auth.uid());
