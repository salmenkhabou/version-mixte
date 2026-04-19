-- Phase 3 procurement module:
-- - Supplier directory
-- - Purchase orders with approval
-- - Goods receiving and invoice matching
-- - Supplier price comparison and lead-time tracking

create extension if not exists pgcrypto;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tax_id text,
  payment_terms_days integer not null default 0 check (payment_terms_days >= 0),
  default_currency text not null default 'MAD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id bigserial primary key,
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled', 'rejected')),
  approval_required boolean not null default true,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  expected_delivery_date date,
  currency text not null default 'MAD',
  subtotal_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_lines (
  id bigserial primary key,
  purchase_order_id bigint not null references public.purchase_orders(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  unit_id text not null references public.ingredient_units(id) on delete restrict,
  description text,
  ordered_qty numeric(14,3) not null check (ordered_qty > 0),
  received_qty numeric(14,3) not null default 0 check (received_qty >= 0),
  unit_price numeric(14,4) not null default 0 check (unit_price >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  line_total numeric(14,2) not null default 0,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, line_no)
);

create table if not exists public.goods_receipts (
  id bigserial primary key,
  receipt_number text not null unique,
  purchase_order_id bigint not null references public.purchase_orders(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  received_by_user_id uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  invoice_number text,
  invoice_date date,
  invoice_total numeric(14,2) not null default 0,
  currency text not null default 'MAD',
  match_status text not null default 'pending' check (match_status in ('pending', 'matched', 'mismatch')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.goods_receipt_lines (
  id bigserial primary key,
  goods_receipt_id bigint not null references public.goods_receipts(id) on delete cascade,
  purchase_order_line_id bigint not null references public.purchase_order_lines(id) on delete restrict,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  unit_id text not null references public.ingredient_units(id) on delete restrict,
  quantity_received numeric(14,3) not null check (quantity_received > 0),
  unit_price numeric(14,4) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (goods_receipt_id, purchase_order_line_id)
);

create table if not exists public.supplier_price_history (
  id bigserial primary key,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  unit_id text not null references public.ingredient_units(id) on delete restrict,
  price numeric(14,4) not null check (price >= 0),
  currency text not null default 'MAD',
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  source_type text not null default 'purchase_order' check (source_type in ('purchase_order', 'goods_receipt', 'manual')),
  source_reference text,
  effective_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payable_bills (
  id bigserial primary key,
  bill_number text not null unique,
  goods_receipt_id bigint not null references public.goods_receipts(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  invoice_number text,
  invoice_date date,
  amount_due numeric(14,2) not null default 0 check (amount_due >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  due_date date,
  currency text not null default 'MAD',
  status text not null default 'open' check (status in ('open', 'partially_paid', 'paid', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_name on public.suppliers (name);
create index if not exists idx_supplier_contacts_supplier on public.supplier_contacts (supplier_id, is_active);
create index if not exists idx_purchase_orders_supplier_created on public.purchase_orders (supplier_id, created_at desc);
create index if not exists idx_purchase_orders_branch_status on public.purchase_orders (branch_id, status, created_at desc);
create index if not exists idx_purchase_order_lines_po on public.purchase_order_lines (purchase_order_id, line_no);
create index if not exists idx_goods_receipts_po on public.goods_receipts (purchase_order_id, received_at desc);
create index if not exists idx_goods_receipt_lines_receipt on public.goods_receipt_lines (goods_receipt_id, purchase_order_line_id);
create index if not exists idx_supplier_price_history_supplier_ingredient on public.supplier_price_history (supplier_id, ingredient_id, effective_at desc);
create index if not exists idx_payable_bills_supplier_status on public.payable_bills (supplier_id, status, due_date);

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
  if not exists (select 1 from pg_trigger where tgname = 'trg_suppliers_set_updated_at') then
    create trigger trg_suppliers_set_updated_at
    before update on public.suppliers
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_supplier_contacts_set_updated_at') then
    create trigger trg_supplier_contacts_set_updated_at
    before update on public.supplier_contacts
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_purchase_orders_set_updated_at') then
    create trigger trg_purchase_orders_set_updated_at
    before update on public.purchase_orders
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_purchase_order_lines_set_updated_at') then
    create trigger trg_purchase_order_lines_set_updated_at
    before update on public.purchase_order_lines
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_payable_bills_set_updated_at') then
    create trigger trg_payable_bills_set_updated_at
    before update on public.payable_bills
    for each row execute function public.app_set_updated_at();
  end if;
end
$$;

alter table public.suppliers enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_lines enable row level security;
alter table public.supplier_price_history enable row level security;
alter table public.payable_bills enable row level security;

grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update on public.supplier_contacts to authenticated;
grant select, insert, update on public.purchase_orders to authenticated;
grant select, insert, update on public.purchase_order_lines to authenticated;
grant select, insert on public.goods_receipts to authenticated;
grant select, insert on public.goods_receipt_lines to authenticated;
grant select, insert on public.supplier_price_history to authenticated;
grant select, insert, update on public.payable_bills to authenticated;

drop policy if exists "Read suppliers" on public.suppliers;
create policy "Read suppliers"
on public.suppliers
for select
to authenticated
using (true);

drop policy if exists "Manage suppliers" on public.suppliers;
create policy "Manage suppliers"
on public.suppliers
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read supplier contacts" on public.supplier_contacts;
create policy "Read supplier contacts"
on public.supplier_contacts
for select
to authenticated
using (true);

drop policy if exists "Manage supplier contacts" on public.supplier_contacts;
create policy "Manage supplier contacts"
on public.supplier_contacts
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read purchase orders" on public.purchase_orders;
create policy "Read purchase orders"
on public.purchase_orders
for select
to authenticated
using (true);

drop policy if exists "Manage purchase orders" on public.purchase_orders;
create policy "Manage purchase orders"
on public.purchase_orders
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read purchase order lines" on public.purchase_order_lines;
create policy "Read purchase order lines"
on public.purchase_order_lines
for select
to authenticated
using (true);

drop policy if exists "Manage purchase order lines" on public.purchase_order_lines;
create policy "Manage purchase order lines"
on public.purchase_order_lines
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read goods receipts" on public.goods_receipts;
create policy "Read goods receipts"
on public.goods_receipts
for select
to authenticated
using (true);

drop policy if exists "Insert goods receipts" on public.goods_receipts;
create policy "Insert goods receipts"
on public.goods_receipts
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read goods receipt lines" on public.goods_receipt_lines;
create policy "Read goods receipt lines"
on public.goods_receipt_lines
for select
to authenticated
using (true);

drop policy if exists "Insert goods receipt lines" on public.goods_receipt_lines;
create policy "Insert goods receipt lines"
on public.goods_receipt_lines
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read supplier price history" on public.supplier_price_history;
create policy "Read supplier price history"
on public.supplier_price_history
for select
to authenticated
using (true);

drop policy if exists "Insert supplier price history" on public.supplier_price_history;
create policy "Insert supplier price history"
on public.supplier_price_history
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read payable bills" on public.payable_bills;
create policy "Read payable bills"
on public.payable_bills
for select
to authenticated
using (true);

drop policy if exists "Manage payable bills" on public.payable_bills;
create policy "Manage payable bills"
on public.payable_bills
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

insert into public.permissions (key, description)
values
  ('suppliers.view', 'View supplier directory and contacts'),
  ('purchase_orders.create', 'Create purchase orders and lines'),
  ('purchase_orders.approve', 'Approve purchase orders'),
  ('purchase_orders.receive', 'Receive goods against purchase orders'),
  ('purchase_orders.status.view', 'View purchase orders grouped by status'),
  ('suppliers.price_history.view', 'View supplier price history and lead-time trends')
on conflict (key) do update
set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('staff', 'suppliers.view'),
  ('staff', 'purchase_orders.create'),
  ('staff', 'purchase_orders.receive'),
  ('staff', 'purchase_orders.status.view'),
  ('staff', 'suppliers.price_history.view'),
  ('manager', 'suppliers.view'),
  ('manager', 'purchase_orders.create'),
  ('manager', 'purchase_orders.approve'),
  ('manager', 'purchase_orders.receive'),
  ('manager', 'purchase_orders.status.view'),
  ('manager', 'suppliers.price_history.view')
on conflict (role_key, permission_key) do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'admin', p.key
from public.permissions p
where p.key in (
  'suppliers.view',
  'purchase_orders.create',
  'purchase_orders.approve',
  'purchase_orders.receive',
  'purchase_orders.status.view',
  'suppliers.price_history.view'
)
on conflict (role_key, permission_key) do nothing;
