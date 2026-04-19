-- Manager cash closure snapshots shared across devices.

create table if not exists public.cafe_cash_closures (
  id bigint generated always as identity primary key,
  closed_at timestamptz not null default now(),
  closed_by_user_id uuid references auth.users(id) on delete set null,
  closed_by_email text,
  period_label text not null,
  note text,
  orders_total integer not null default 0,
  orders_served integer not null default 0,
  orders_cancelled integer not null default 0,
  revenue_served numeric(12,2) not null default 0,
  amount_cancelled numeric(12,2) not null default 0,
  amount_active numeric(12,2) not null default 0,
  counted_cash numeric(12,2) not null default 0,
  expected_cash numeric(12,2) not null default 0,
  cash_difference numeric(12,2) not null default 0,
  difference_alert boolean not null default false,
  sla_rate integer not null default 0 check (sla_rate >= 0 and sla_rate <= 100),
  created_at timestamptz not null default now()
);

alter table public.cafe_cash_closures add column if not exists counted_cash numeric(12,2) not null default 0;
alter table public.cafe_cash_closures add column if not exists expected_cash numeric(12,2) not null default 0;
alter table public.cafe_cash_closures add column if not exists cash_difference numeric(12,2) not null default 0;
alter table public.cafe_cash_closures add column if not exists difference_alert boolean not null default false;

create index if not exists idx_cafe_cash_closures_closed_at
  on public.cafe_cash_closures (closed_at desc);

alter table public.cafe_cash_closures enable row level security;

grant select, insert, delete on table public.cafe_cash_closures to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S'
      and c.relname = 'cafe_cash_closures_id_seq'
      and n.nspname = 'public'
  ) then
    grant usage, select on sequence public.cafe_cash_closures_id_seq to authenticated;
  end if;
end
$$;

drop policy if exists "Managers can read cash closures" on public.cafe_cash_closures;
create policy "Managers can read cash closures"
on public.cafe_cash_closures
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.staff_users s
    where s.user_id = auth.uid()
      and lower(coalesce(s.role, '')) = 'manager'
  )
);

drop policy if exists "Managers can insert cash closures" on public.cafe_cash_closures;
create policy "Managers can insert cash closures"
on public.cafe_cash_closures
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.staff_users s
    where s.user_id = auth.uid()
      and lower(coalesce(s.role, '')) = 'manager'
  )
);

drop policy if exists "Managers can delete cash closures" on public.cafe_cash_closures;
create policy "Managers can delete cash closures"
on public.cafe_cash_closures
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.staff_users s
    where s.user_id = auth.uid()
      and lower(coalesce(s.role, '')) = 'manager'
  )
);
