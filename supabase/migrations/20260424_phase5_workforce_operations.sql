-- Phase 5 workforce module:
-- - Shift scheduling
-- - Mobile attendance check-in/check-out
-- - Opening/closing checklist execution
-- - Staff performance dashboards
-- - Incident reporting with photo evidence

create extension if not exists pgcrypto;

create table if not exists public.shifts (
  id bigserial primary key,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  shift_label text not null,
  shift_type text not null default 'general' check (shift_type in ('opening', 'closing', 'general', 'morning', 'evening', 'night')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.shift_assignments (
  id bigserial primary key,
  shift_id bigint not null references public.shifts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null default 'staff',
  status text not null default 'assigned' check (status in ('assigned', 'checked_in', 'checked_out', 'absent')),
  assigned_by_user_id uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  check_in_at timestamptz,
  check_out_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, user_id)
);

create table if not exists public.attendance_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  shift_id bigint references public.shifts(id) on delete set null,
  assignment_id bigint references public.shift_assignments(id) on delete set null,
  event_type text not null check (event_type in ('check_in', 'check_out')),
  event_at timestamptz not null default now(),
  latitude numeric(10,7),
  longitude numeric(10,7),
  device_info text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  branch_id text references public.erp_branches(id) on delete set null,
  name text not null,
  checklist_type text not null default 'general' check (checklist_type in ('opening', 'closing', 'general')),
  items jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_runs (
  id bigserial primary key,
  template_id uuid not null references public.checklist_templates(id) on delete restrict,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  shift_id bigint references public.shifts(id) on delete set null,
  assignment_id bigint references public.shift_assignments(id) on delete set null,
  run_date date not null default current_date,
  status text not null default 'completed' check (status in ('in_progress', 'completed', 'failed')),
  completed_items jsonb not null default '[]'::jsonb,
  notes text,
  completed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id bigserial primary key,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  shift_id bigint references public.shifts(id) on delete set null,
  reported_by_user_id uuid references auth.users(id) on delete set null,
  incident_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'closed')),
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incident_attachments (
  id bigserial primary key,
  incident_id bigint not null references public.incidents(id) on delete cascade,
  file_url text not null,
  mime_type text,
  file_name text,
  size_bytes bigint,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_kpis (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id text not null references public.erp_branches(id) on delete cascade,
  kpi_date date not null,
  orders_handled integer not null default 0,
  orders_served integer not null default 0,
  orders_cancelled integer not null default 0,
  attendance_minutes integer not null default 0,
  checklists_completed integer not null default 0,
  incidents_reported integer not null default 0,
  late_arrivals integer not null default 0,
  performance_score numeric(6,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, branch_id, kpi_date)
);

create index if not exists idx_shifts_branch_start on public.shifts (branch_id, starts_at desc);
create index if not exists idx_shift_assignments_user_status on public.shift_assignments (user_id, status, assigned_at desc);
create index if not exists idx_shift_assignments_shift on public.shift_assignments (shift_id, status);
create index if not exists idx_attendance_logs_user_event on public.attendance_logs (user_id, event_at desc);
create index if not exists idx_attendance_logs_branch_event on public.attendance_logs (branch_id, event_at desc);
create index if not exists idx_checklist_templates_branch_type on public.checklist_templates (branch_id, checklist_type, is_active);
create index if not exists idx_checklist_runs_template_date on public.checklist_runs (template_id, run_date desc);
create index if not exists idx_incidents_branch_occurred on public.incidents (branch_id, occurred_at desc);
create index if not exists idx_incidents_status_severity on public.incidents (status, severity, occurred_at desc);
create index if not exists idx_incident_attachments_incident on public.incident_attachments (incident_id, created_at desc);
create index if not exists idx_staff_kpis_branch_date on public.staff_kpis (branch_id, kpi_date desc);
create index if not exists idx_staff_kpis_user_date on public.staff_kpis (user_id, kpi_date desc);

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
  if not exists (select 1 from pg_trigger where tgname = 'trg_shifts_set_updated_at') then
    create trigger trg_shifts_set_updated_at
    before update on public.shifts
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_shift_assignments_set_updated_at') then
    create trigger trg_shift_assignments_set_updated_at
    before update on public.shift_assignments
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_checklist_templates_set_updated_at') then
    create trigger trg_checklist_templates_set_updated_at
    before update on public.checklist_templates
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_checklist_runs_set_updated_at') then
    create trigger trg_checklist_runs_set_updated_at
    before update on public.checklist_runs
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_incidents_set_updated_at') then
    create trigger trg_incidents_set_updated_at
    before update on public.incidents
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_staff_kpis_set_updated_at') then
    create trigger trg_staff_kpis_set_updated_at
    before update on public.staff_kpis
    for each row execute function public.app_set_updated_at();
  end if;
end
$$;

insert into public.checklist_templates (branch_id, name, checklist_type, items, is_active)
values
  ('main', 'Opening Shift Checklist', 'opening',
    '[
      {"id":"open-1","label":"Verify cash drawer float","required":true},
      {"id":"open-2","label":"Start espresso machine warmup","required":true},
      {"id":"open-3","label":"Check ingredient par levels","required":true}
    ]'::jsonb,
    true
  ),
  ('main', 'Closing Shift Checklist', 'closing',
    '[
      {"id":"close-1","label":"Count cash and reconcile","required":true},
      {"id":"close-2","label":"Sanitize workstations","required":true},
      {"id":"close-3","label":"Secure stock and lock storage","required":true}
    ]'::jsonb,
    true
  )
on conflict do nothing;

alter table public.shifts enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_runs enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_attachments enable row level security;
alter table public.staff_kpis enable row level security;

grant select, insert, update on public.shifts to authenticated;
grant select, insert, update on public.shift_assignments to authenticated;
grant select, insert on public.attendance_logs to authenticated;
grant select on public.checklist_templates to authenticated;
grant select, insert, update on public.checklist_runs to authenticated;
grant select, insert, update on public.incidents to authenticated;
grant select, insert on public.incident_attachments to authenticated;
grant select, insert, update on public.staff_kpis to authenticated;

drop policy if exists "Read shifts" on public.shifts;
create policy "Read shifts"
on public.shifts
for select
to authenticated
using (true);

drop policy if exists "Manage shifts" on public.shifts;
create policy "Manage shifts"
on public.shifts
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read shift assignments" on public.shift_assignments;
create policy "Read shift assignments"
on public.shift_assignments
for select
to authenticated
using (true);

drop policy if exists "Manage shift assignments" on public.shift_assignments;
create policy "Manage shift assignments"
on public.shift_assignments
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read attendance logs" on public.attendance_logs;
create policy "Read attendance logs"
on public.attendance_logs
for select
to authenticated
using (true);

drop policy if exists "Insert attendance logs" on public.attendance_logs;
create policy "Insert attendance logs"
on public.attendance_logs
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read checklist templates" on public.checklist_templates;
create policy "Read checklist templates"
on public.checklist_templates
for select
to authenticated
using (true);

drop policy if exists "Manage checklist templates" on public.checklist_templates;
create policy "Manage checklist templates"
on public.checklist_templates
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read checklist runs" on public.checklist_runs;
create policy "Read checklist runs"
on public.checklist_runs
for select
to authenticated
using (true);

drop policy if exists "Manage checklist runs" on public.checklist_runs;
create policy "Manage checklist runs"
on public.checklist_runs
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read incidents" on public.incidents;
create policy "Read incidents"
on public.incidents
for select
to authenticated
using (true);

drop policy if exists "Manage incidents" on public.incidents;
create policy "Manage incidents"
on public.incidents
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read incident attachments" on public.incident_attachments;
create policy "Read incident attachments"
on public.incident_attachments
for select
to authenticated
using (true);

drop policy if exists "Insert incident attachments" on public.incident_attachments;
create policy "Insert incident attachments"
on public.incident_attachments
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read staff kpis" on public.staff_kpis;
create policy "Read staff kpis"
on public.staff_kpis
for select
to authenticated
using (true);

drop policy if exists "Manage staff kpis" on public.staff_kpis;
create policy "Manage staff kpis"
on public.staff_kpis
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

insert into public.permissions (key, description)
values
  ('shifts.create', 'Create and schedule workforce shifts'),
  ('attendance.check_in', 'Perform mobile attendance check-in'),
  ('attendance.check_out', 'Perform mobile attendance check-out'),
  ('attendance.today.view', 'View attendance logs for the day'),
  ('checklists.complete', 'Complete checklist runs for opening/closing tasks'),
  ('incidents.create', 'Create incident reports with attachments'),
  ('staff.kpis.view', 'View staff KPI dashboard metrics')
on conflict (key) do update
set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('staff', 'attendance.check_in'),
  ('staff', 'attendance.check_out'),
  ('staff', 'attendance.today.view'),
  ('staff', 'checklists.complete'),
  ('staff', 'incidents.create'),
  ('manager', 'shifts.create'),
  ('manager', 'attendance.check_in'),
  ('manager', 'attendance.check_out'),
  ('manager', 'attendance.today.view'),
  ('manager', 'checklists.complete'),
  ('manager', 'incidents.create'),
  ('manager', 'staff.kpis.view')
on conflict (role_key, permission_key) do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'admin', p.key
from public.permissions p
where p.key in (
  'shifts.create',
  'attendance.check_in',
  'attendance.check_out',
  'attendance.today.view',
  'checklists.complete',
  'incidents.create',
  'staff.kpis.view'
)
on conflict (role_key, permission_key) do nothing;
