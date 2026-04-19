-- Phase 4 finance module:
-- - Cash sessions by shift
-- - Expense management
-- - Refund/void approval flow
-- - Daily P&L snapshots
-- - Tax-ready sales and expense exports

create extension if not exists pgcrypto;

create table if not exists public.cash_sessions (
  id bigserial primary key,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  shift_label text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_balance numeric(14,2) not null default 0,
  expected_closing_balance numeric(14,2) not null default 0,
  counted_closing_balance numeric(14,2),
  difference_amount numeric(14,2),
  note text,
  opened_by_user_id uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_by_user_id uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_movements (
  id bigserial primary key,
  cash_session_id bigint references public.cash_sessions(id) on delete set null,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  movement_kind text not null check (movement_kind in ('sale', 'expense', 'refund', 'adjustment', 'deposit', 'withdrawal', 'opening', 'closing')),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'MAD',
  reference_type text,
  reference_id text,
  note text,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id bigserial primary key,
  order_id bigint,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  cash_session_id bigint references public.cash_sessions(id) on delete set null,
  payment_method text not null check (payment_method in ('cash', 'card', 'mobile', 'transfer', 'other')),
  status text not null default 'captured' check (status in ('captured', 'partially_refunded', 'refunded', 'voided')),
  currency text not null default 'MAD',
  amount_gross numeric(14,2) not null check (amount_gross >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  amount_net numeric(14,2) not null check (amount_net >= 0),
  paid_at timestamptz not null default now(),
  captured_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id bigserial primary key,
  payment_id bigint not null references public.payments(id) on delete cascade,
  order_id bigint,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  request_type text not null default 'refund' check (request_type in ('refund', 'void')),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  approved_amount numeric(14,2),
  reason text not null,
  note text,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  gl_account_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id bigserial primary key,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  cash_session_id bigint references public.cash_sessions(id) on delete set null,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  amount_net numeric(14,2) not null check (amount_net >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  amount_gross numeric(14,2) not null check (amount_gross >= 0),
  currency text not null default 'MAD',
  payment_method text not null default 'cash' check (payment_method in ('cash', 'card', 'mobile', 'transfer', 'other')),
  vendor_name text,
  description text,
  expense_date date not null default current_date,
  receipt_number text,
  status text not null default 'recorded' check (status in ('recorded', 'approved', 'voided')),
  entered_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_closures (
  id bigserial primary key,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  closure_date date not null,
  sales_gross numeric(14,2) not null default 0,
  sales_tax numeric(14,2) not null default 0,
  sales_net numeric(14,2) not null default 0,
  refunds_total numeric(14,2) not null default 0,
  expenses_total numeric(14,2) not null default 0,
  gross_profit numeric(14,2) not null default 0,
  net_profit numeric(14,2) not null default 0,
  cash_opening numeric(14,2) not null default 0,
  cash_closing numeric(14,2) not null default 0,
  tax_liability numeric(14,2) not null default 0,
  snapshot_by_user_id uuid references auth.users(id) on delete set null,
  snapshot_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, closure_date)
);

create table if not exists public.gl_mappings (
  id uuid primary key default gen_random_uuid(),
  branch_id text references public.erp_branches(id) on delete set null,
  mapping_type text not null check (mapping_type in ('payment_method', 'expense_category', 'tax', 'refund', 'sales')),
  source_key text not null,
  gl_account_code text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, mapping_type, source_key)
);

create table if not exists public.fiscal_exports (
  id bigserial primary key,
  export_number text not null unique,
  branch_id text references public.erp_branches(id) on delete set null,
  period_start date not null,
  period_end date not null,
  format text not null check (format in ('json', 'csv')),
  status text not null default 'generated' check (status in ('generated', 'failed')),
  row_count integer not null default 0,
  totals jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  generated_by_user_id uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_sessions_branch_status on public.cash_sessions (branch_id, status, opened_at desc);
create index if not exists idx_cash_movements_session_created on public.cash_movements (cash_session_id, created_at desc);
create index if not exists idx_cash_movements_branch_created on public.cash_movements (branch_id, created_at desc);
create index if not exists idx_payments_branch_paid on public.payments (branch_id, paid_at desc);
create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_refunds_branch_requested on public.refunds (branch_id, requested_at desc);
create index if not exists idx_refunds_payment on public.refunds (payment_id, status);
create index if not exists idx_expenses_branch_date on public.expenses (branch_id, expense_date desc);
create index if not exists idx_financial_closures_date on public.financial_closures (closure_date desc, branch_id);
create index if not exists idx_gl_mappings_type_key on public.gl_mappings (mapping_type, source_key, is_active);
create index if not exists idx_fiscal_exports_period on public.fiscal_exports (period_start, period_end, generated_at desc);

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
  if not exists (select 1 from pg_trigger where tgname = 'trg_cash_sessions_set_updated_at') then
    create trigger trg_cash_sessions_set_updated_at
    before update on public.cash_sessions
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_payments_set_updated_at') then
    create trigger trg_payments_set_updated_at
    before update on public.payments
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_refunds_set_updated_at') then
    create trigger trg_refunds_set_updated_at
    before update on public.refunds
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_expense_categories_set_updated_at') then
    create trigger trg_expense_categories_set_updated_at
    before update on public.expense_categories
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_expenses_set_updated_at') then
    create trigger trg_expenses_set_updated_at
    before update on public.expenses
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_financial_closures_set_updated_at') then
    create trigger trg_financial_closures_set_updated_at
    before update on public.financial_closures
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_gl_mappings_set_updated_at') then
    create trigger trg_gl_mappings_set_updated_at
    before update on public.gl_mappings
    for each row execute function public.app_set_updated_at();
  end if;
end
$$;

insert into public.expense_categories (code, name, gl_account_code, is_active)
values
  ('rent', 'Rent', '6110', true),
  ('utilities', 'Utilities', '6120', true),
  ('supplies', 'Supplies', '6130', true),
  ('maintenance', 'Maintenance', '6140', true),
  ('transport', 'Transport', '6150', true),
  ('other', 'Other', '6199', true)
on conflict (code) do update
set
  name = excluded.name,
  gl_account_code = excluded.gl_account_code,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.gl_mappings (branch_id, mapping_type, source_key, gl_account_code, description, is_active)
values
  (null, 'sales', 'default', '7010', 'Default sales account', true),
  (null, 'tax', 'vat', '4457', 'Output VAT account', true),
  (null, 'refund', 'default', '7090', 'Sales returns/refunds account', true),
  (null, 'payment_method', 'cash', '5310', 'Cash register account', true),
  (null, 'payment_method', 'card', '5120', 'Bank card settlement account', true),
  (null, 'payment_method', 'mobile', '5125', 'Mobile wallet settlement account', true),
  (null, 'payment_method', 'transfer', '5140', 'Bank transfer account', true),
  (null, 'payment_method', 'other', '5199', 'Other settlement account', true)
on conflict (branch_id, mapping_type, source_key) do nothing;

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.financial_closures enable row level security;
alter table public.gl_mappings enable row level security;
alter table public.fiscal_exports enable row level security;

grant select, insert, update on public.cash_sessions to authenticated;
grant select, insert on public.cash_movements to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select, insert, update on public.refunds to authenticated;
grant select on public.expense_categories to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert, update on public.financial_closures to authenticated;
grant select, insert, update on public.gl_mappings to authenticated;
grant select, insert on public.fiscal_exports to authenticated;

drop policy if exists "Read cash sessions" on public.cash_sessions;
create policy "Read cash sessions"
on public.cash_sessions
for select
to authenticated
using (true);

drop policy if exists "Manage cash sessions" on public.cash_sessions;
create policy "Manage cash sessions"
on public.cash_sessions
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read cash movements" on public.cash_movements;
create policy "Read cash movements"
on public.cash_movements
for select
to authenticated
using (true);

drop policy if exists "Insert cash movements" on public.cash_movements;
create policy "Insert cash movements"
on public.cash_movements
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read payments" on public.payments;
create policy "Read payments"
on public.payments
for select
to authenticated
using (true);

drop policy if exists "Manage payments" on public.payments;
create policy "Manage payments"
on public.payments
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read refunds" on public.refunds;
create policy "Read refunds"
on public.refunds
for select
to authenticated
using (true);

drop policy if exists "Manage refunds" on public.refunds;
create policy "Manage refunds"
on public.refunds
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read expense categories" on public.expense_categories;
create policy "Read expense categories"
on public.expense_categories
for select
to authenticated
using (true);

drop policy if exists "Read expenses" on public.expenses;
create policy "Read expenses"
on public.expenses
for select
to authenticated
using (true);

drop policy if exists "Manage expenses" on public.expenses;
create policy "Manage expenses"
on public.expenses
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read financial closures" on public.financial_closures;
create policy "Read financial closures"
on public.financial_closures
for select
to authenticated
using (true);

drop policy if exists "Manage financial closures" on public.financial_closures;
create policy "Manage financial closures"
on public.financial_closures
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read gl mappings" on public.gl_mappings;
create policy "Read gl mappings"
on public.gl_mappings
for select
to authenticated
using (true);

drop policy if exists "Manage gl mappings" on public.gl_mappings;
create policy "Manage gl mappings"
on public.gl_mappings
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read fiscal exports" on public.fiscal_exports;
create policy "Read fiscal exports"
on public.fiscal_exports
for select
to authenticated
using (true);

drop policy if exists "Insert fiscal exports" on public.fiscal_exports;
create policy "Insert fiscal exports"
on public.fiscal_exports
for insert
to authenticated
with check (auth.uid() is not null);

insert into public.permissions (key, description)
values
  ('cash.sessions.open', 'Open a cash session for a branch shift'),
  ('cash.sessions.close', 'Close a cash session and register balancing result'),
  ('expenses.create', 'Record and approve operating expenses'),
  ('refunds.request', 'Request a refund or void operation'),
  ('refunds.approve', 'Approve requested refund or void operations'),
  ('finance.daily_summary.view', 'View and snapshot daily P&L summaries'),
  ('finance.export.view', 'Generate tax-ready finance export data')
on conflict (key) do update
set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('staff', 'cash.sessions.open'),
  ('staff', 'expenses.create'),
  ('staff', 'refunds.request'),
  ('staff', 'finance.daily_summary.view'),
  ('manager', 'cash.sessions.open'),
  ('manager', 'cash.sessions.close'),
  ('manager', 'expenses.create'),
  ('manager', 'refunds.request'),
  ('manager', 'refunds.approve'),
  ('manager', 'finance.daily_summary.view'),
  ('manager', 'finance.export.view')
on conflict (role_key, permission_key) do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'admin', p.key
from public.permissions p
where p.key in (
  'cash.sessions.open',
  'cash.sessions.close',
  'expenses.create',
  'refunds.request',
  'refunds.approve',
  'finance.daily_summary.view',
  'finance.export.view'
)
on conflict (role_key, permission_key) do nothing;
