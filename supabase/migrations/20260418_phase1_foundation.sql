-- Phase 1 foundation: branch registry + notification device tokens.

create table if not exists public.erp_branches (
  id text primary key,
  code text unique not null,
  name text not null,
  timezone text not null default 'Africa/Tunis',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.erp_branches (id, code, name, timezone, is_active)
values ('main', 'MAIN', 'Main Branch', 'Africa/Tunis', true)
on conflict (id) do nothing;

alter table public.erp_branches enable row level security;

grant select on table public.erp_branches to anon, authenticated;
grant insert, update, delete on table public.erp_branches to authenticated;

drop policy if exists "Read branches" on public.erp_branches;
create policy "Read branches"
on public.erp_branches
for select
to anon, authenticated
using (true);

drop policy if exists "Manage branches" on public.erp_branches;
create policy "Manage branches"
on public.erp_branches
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create table if not exists public.notification_tokens (
  device_id text primary key,
  token text not null,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'guest',
  branch_id text references public.erp_branches(id) on delete set null,
  platform text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_tokens_user_id on public.notification_tokens (user_id);
create index if not exists idx_notification_tokens_branch_id on public.notification_tokens (branch_id);

alter table public.notification_tokens enable row level security;

grant select, insert, update on table public.notification_tokens to authenticated;

drop policy if exists "Manage own notification tokens" on public.notification_tokens;
create policy "Manage own notification tokens"
on public.notification_tokens
for all
to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());
