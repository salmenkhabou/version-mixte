-- Server-driven notification events for targeted push delivery.

create table if not exists public.notification_events (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  target_role text not null default 'all' check (lower(target_role) in ('all', 'customer', 'staff', 'manager', 'admin')),
  target_user_id uuid references auth.users(id) on delete set null,
  branch_id text references public.erp_branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_events_created_at
  on public.notification_events (created_at desc);

create index if not exists idx_notification_events_target_role
  on public.notification_events (target_role);

create index if not exists idx_notification_events_target_user
  on public.notification_events (target_user_id)
  where target_user_id is not null;

alter table public.notification_events enable row level security;

grant select, insert on table public.notification_events to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S'
      and c.relname = 'notification_events_id_seq'
      and n.nspname = 'public'
  ) then
    grant usage, select on sequence public.notification_events_id_seq to authenticated;
  end if;
end
$$;

drop policy if exists "Read matching notification events" on public.notification_events;
create policy "Read matching notification events"
on public.notification_events
for select
to authenticated
using (
  (
    target_user_id is not null
    and target_user_id = auth.uid()
  )
  or
  (
    target_user_id is null
    and (
      lower(coalesce(target_role, 'all')) = 'all'
      or lower(coalesce(target_role, 'all')) = coalesce(
        (
          select lower(s.role)
          from public.staff_users s
          where s.user_id = auth.uid()
          limit 1
        ),
        case when public.is_admin() then 'admin' else 'customer' end
      )
      or (
        public.is_admin()
        and lower(coalesce(target_role, 'all')) in ('staff', 'manager', 'admin')
      )
    )
  )
);

drop policy if exists "Staff managers and admins can publish notification events" on public.notification_events;
create policy "Staff managers and admins can publish notification events"
on public.notification_events
for insert
to authenticated
with check (
  public.is_admin() or public.is_staff()
);
