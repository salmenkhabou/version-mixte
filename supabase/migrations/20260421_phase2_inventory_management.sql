-- Phase 2 inventory module:
-- - Ingredient stock, recipes, automatic sale consumption, low-stock alerts,
--   manual adjustments, and wastage logging.
-- - Feature toggle is controlled by app_state.settings.showInventoryModule.

create extension if not exists pgcrypto;

create table if not exists public.ingredient_units (
  id text primary key,
  name text not null,
  symbol text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ingredient_units (id, name, symbol)
values
  ('g', 'Gram', 'g'),
  ('kg', 'Kilogram', 'kg'),
  ('ml', 'Milliliter', 'ml'),
  ('l', 'Liter', 'l'),
  ('unit', 'Unit', 'u')
on conflict (id) do update
set
  name = excluded.name,
  symbol = excluded.symbol,
  updated_at = now();

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_unit_id text not null references public.ingredient_units(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  external_key text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_recipes (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  unit_id text not null references public.ingredient_units(id) on delete restrict,
  qty_per_serving numeric(14,3) not null check (qty_per_serving > 0),
  waste_factor numeric(6,4) not null default 0 check (waste_factor >= 0 and waste_factor <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, ingredient_id)
);

create table if not exists public.inventory_levels (
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  branch_id text not null references public.erp_branches(id) on delete cascade,
  on_hand_qty numeric(14,3) not null default 0,
  reserved_qty numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ingredient_id, branch_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  movement_type text not null check (movement_type in ('initial', 'adjustment_in', 'adjustment_out', 'sale_consume', 'waste', 'manual')),
  quantity_delta numeric(14,3) not null,
  balance_after numeric(14,3),
  reason_code text,
  reason_note text,
  reference_order_id bigint,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wastage_reasons (
  code text primary key,
  label text not null,
  requires_note boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.wastage_reasons (code, label, requires_note, is_active)
values
  ('expired', 'Expired', false, true),
  ('spill', 'Spillage', false, true),
  ('quality', 'Quality issue', false, true),
  ('damage', 'Damaged package', false, true),
  ('other', 'Other', true, true)
on conflict (code) do update
set
  label = excluded.label,
  requires_note = excluded.requires_note,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.wastage_logs (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  branch_id text not null references public.erp_branches(id) on delete restrict,
  unit_id text not null references public.ingredient_units(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  reason_code text not null references public.wastage_reasons(code) on delete restrict,
  note text,
  actor_user_id uuid references auth.users(id) on delete set null,
  movement_id uuid references public.inventory_movements(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.reorder_rules (
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  branch_id text not null references public.erp_branches(id) on delete cascade,
  min_qty numeric(14,3) not null default 0,
  reorder_qty numeric(14,3) not null default 0,
  alert_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ingredient_id, branch_id)
);

create index if not exists idx_ingredients_name on public.ingredients (name);
create index if not exists idx_products_name on public.products (name);
create index if not exists idx_products_external_key on public.products (external_key);
create index if not exists idx_product_recipes_ingredient on public.product_recipes (ingredient_id);
create index if not exists idx_inventory_levels_branch on public.inventory_levels (branch_id);
create index if not exists idx_inventory_movements_branch_created on public.inventory_movements (branch_id, created_at desc);
create index if not exists idx_inventory_movements_ingredient_created on public.inventory_movements (ingredient_id, created_at desc);
create index if not exists idx_inventory_movements_reference_order on public.inventory_movements (reference_order_id);
create unique index if not exists ux_inventory_movements_sale_order_ingredient
  on public.inventory_movements (reference_order_id, branch_id, ingredient_id)
  where movement_type = 'sale_consume' and reference_order_id is not null;
create index if not exists idx_wastage_logs_branch_created on public.wastage_logs (branch_id, created_at desc);
create index if not exists idx_reorder_rules_alerts on public.reorder_rules (branch_id, alert_enabled, min_qty);

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
  if not exists (select 1 from pg_trigger where tgname = 'trg_ingredient_units_set_updated_at') then
    create trigger trg_ingredient_units_set_updated_at
    before update on public.ingredient_units
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_ingredients_set_updated_at') then
    create trigger trg_ingredients_set_updated_at
    before update on public.ingredients
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_products_set_updated_at') then
    create trigger trg_products_set_updated_at
    before update on public.products
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_product_recipes_set_updated_at') then
    create trigger trg_product_recipes_set_updated_at
    before update on public.product_recipes
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_inventory_levels_set_updated_at') then
    create trigger trg_inventory_levels_set_updated_at
    before update on public.inventory_levels
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_wastage_reasons_set_updated_at') then
    create trigger trg_wastage_reasons_set_updated_at
    before update on public.wastage_reasons
    for each row execute function public.app_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_reorder_rules_set_updated_at') then
    create trigger trg_reorder_rules_set_updated_at
    before update on public.reorder_rules
    for each row execute function public.app_set_updated_at();
  end if;
end
$$;

alter table public.ingredient_units enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.product_recipes enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.wastage_reasons enable row level security;
alter table public.wastage_logs enable row level security;
alter table public.reorder_rules enable row level security;

grant select on public.ingredient_units to authenticated;
grant select on public.ingredients to authenticated;
grant select on public.products to authenticated;
grant select on public.product_recipes to authenticated;
grant select, insert, update on public.inventory_levels to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select on public.wastage_reasons to authenticated;
grant select, insert on public.wastage_logs to authenticated;
grant select, insert, update on public.reorder_rules to authenticated;

drop policy if exists "Read ingredient units" on public.ingredient_units;
create policy "Read ingredient units"
on public.ingredient_units
for select
to authenticated
using (true);

drop policy if exists "Read ingredients" on public.ingredients;
create policy "Read ingredients"
on public.ingredients
for select
to authenticated
using (true);

drop policy if exists "Manage ingredients" on public.ingredients;
create policy "Manage ingredients"
on public.ingredients
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read products" on public.products;
create policy "Read products"
on public.products
for select
to authenticated
using (true);

drop policy if exists "Manage products" on public.products;
create policy "Manage products"
on public.products
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read product recipes" on public.product_recipes;
create policy "Read product recipes"
on public.product_recipes
for select
to authenticated
using (true);

drop policy if exists "Manage product recipes" on public.product_recipes;
create policy "Manage product recipes"
on public.product_recipes
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read inventory levels" on public.inventory_levels;
create policy "Read inventory levels"
on public.inventory_levels
for select
to authenticated
using (true);

drop policy if exists "Manage inventory levels" on public.inventory_levels;
create policy "Manage inventory levels"
on public.inventory_levels
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read inventory movements" on public.inventory_movements;
create policy "Read inventory movements"
on public.inventory_movements
for select
to authenticated
using (true);

drop policy if exists "Insert inventory movements" on public.inventory_movements;
create policy "Insert inventory movements"
on public.inventory_movements
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read wastage reasons" on public.wastage_reasons;
create policy "Read wastage reasons"
on public.wastage_reasons
for select
to authenticated
using (true);

drop policy if exists "Manage wastage reasons" on public.wastage_reasons;
create policy "Manage wastage reasons"
on public.wastage_reasons
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Read wastage logs" on public.wastage_logs;
create policy "Read wastage logs"
on public.wastage_logs
for select
to authenticated
using (true);

drop policy if exists "Insert wastage logs" on public.wastage_logs;
create policy "Insert wastage logs"
on public.wastage_logs
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Read reorder rules" on public.reorder_rules;
create policy "Read reorder rules"
on public.reorder_rules
for select
to authenticated
using (true);

drop policy if exists "Manage reorder rules" on public.reorder_rules;
create policy "Manage reorder rules"
on public.reorder_rules
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

insert into public.permissions (key, description)
values
  ('inventory.levels.view', 'View ingredient-level inventory levels'),
  ('inventory.adjustments.write', 'Create stock adjustment movements'),
  ('inventory.waste.write', 'Log waste and stock deductions by reason code'),
  ('products.recipes.view', 'View product to recipe consumption mapping'),
  ('orders.consume_stock', 'Consume ingredient stock for sold orders'),
  ('inventory.alerts.low_stock.view', 'View low-stock alerts from reorder rules')
on conflict (key) do update
set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('staff', 'inventory.levels.view'),
  ('staff', 'products.recipes.view'),
  ('staff', 'orders.consume_stock'),
  ('staff', 'inventory.alerts.low_stock.view'),
  ('manager', 'inventory.levels.view'),
  ('manager', 'inventory.adjustments.write'),
  ('manager', 'inventory.waste.write'),
  ('manager', 'products.recipes.view'),
  ('manager', 'orders.consume_stock'),
  ('manager', 'inventory.alerts.low_stock.view')
on conflict (role_key, permission_key) do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'admin', p.key
from public.permissions p
where p.key in (
  'inventory.levels.view',
  'inventory.adjustments.write',
  'inventory.waste.write',
  'products.recipes.view',
  'orders.consume_stock',
  'inventory.alerts.low_stock.view'
)
on conflict (role_key, permission_key) do nothing;

create or replace function public.inventory_module_enabled()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean := false;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'app_state'
  ) then
    select coalesce((settings ->> 'showInventoryModule')::boolean, false)
    into v_enabled
    from public.app_state
    where id = 'global'
    limit 1;
  end if;

  return coalesce(v_enabled, false);
exception
  when others then
    return false;
end;
$$;

revoke all on function public.inventory_module_enabled() from public;
grant execute on function public.inventory_module_enabled() to anon, authenticated;

create or replace function public.inventory_apply_movement(
  p_ingredient_id uuid,
  p_branch_id text,
  p_quantity_delta numeric,
  p_movement_type text,
  p_reason_code text default null,
  p_reason_note text default null,
  p_reference_order_id bigint default null,
  p_actor_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_enforce_non_negative boolean default true
)
returns table (movement_id uuid, balance_after numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric := 0;
  v_next numeric := 0;
begin
  if p_ingredient_id is null then
    raise exception 'INV_ERR_INGREDIENT_REQUIRED';
  end if;

  if coalesce(trim(p_branch_id), '') = '' then
    raise exception 'INV_ERR_BRANCH_REQUIRED';
  end if;

  if coalesce(p_quantity_delta, 0) = 0 then
    raise exception 'INV_ERR_ZERO_DELTA';
  end if;

  insert into public.inventory_levels (ingredient_id, branch_id, on_hand_qty)
  values (p_ingredient_id, p_branch_id, 0)
  on conflict (ingredient_id, branch_id) do nothing;

  select l.on_hand_qty
  into v_current
  from public.inventory_levels l
  where l.ingredient_id = p_ingredient_id
    and l.branch_id = p_branch_id
  for update;

  v_next := coalesce(v_current, 0) + p_quantity_delta;

  if p_enforce_non_negative and v_next < 0 then
    raise exception 'INV_ERR_INSUFFICIENT_STOCK';
  end if;

  update public.inventory_levels
  set
    on_hand_qty = v_next,
    updated_at = now()
  where ingredient_id = p_ingredient_id
    and branch_id = p_branch_id;

  insert into public.inventory_movements (
    ingredient_id,
    branch_id,
    movement_type,
    quantity_delta,
    balance_after,
    reason_code,
    reason_note,
    reference_order_id,
    actor_user_id,
    metadata
  )
  values (
    p_ingredient_id,
    p_branch_id,
    p_movement_type,
    p_quantity_delta,
    v_next,
    nullif(trim(coalesce(p_reason_code, '')), ''),
    nullif(trim(coalesce(p_reason_note, '')), ''),
    p_reference_order_id,
    p_actor_user_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id, inventory_movements.balance_after
  into movement_id, balance_after;

  return next;
end;
$$;

revoke all on function public.inventory_apply_movement(uuid, text, numeric, text, text, text, bigint, uuid, jsonb, boolean) from public;
grant execute on function public.inventory_apply_movement(uuid, text, numeric, text, text, text, bigint, uuid, jsonb, boolean) to authenticated;

create or replace function public.consume_stock_for_order(
  p_order_id bigint,
  p_actor_user_id uuid default null,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item jsonb;
  v_item_key text;
  v_item_name text;
  v_qty_text text;
  v_item_qty numeric;
  v_product_id uuid;
  v_branch_id text;
  v_need record;
  v_consumed_count integer := 0;
  v_missing_products_count integer := 0;
  v_duplicate_count integer := 0;
begin
  if not public.inventory_module_enabled() then
    return jsonb_build_object(
      'ok', false,
      'message', 'inventory-module-disabled',
      'orderId', p_order_id
    );
  end if;

  execute 'select id, branch_id, status, items from public.cafe_orders where id = $1'
  into v_order
  using p_order_id;

  if v_order.id is null then
    raise exception 'INV_ERR_ORDER_NOT_FOUND';
  end if;

  if coalesce(v_order.status, '') <> 'served' then
    raise exception 'INV_ERR_ORDER_NOT_SERVED';
  end if;

  v_branch_id := coalesce(nullif(trim(coalesce(v_order.branch_id, '')), ''), 'main');

  create temporary table if not exists tmp_inventory_need (
    ingredient_id uuid primary key,
    qty numeric not null default 0
  ) on commit drop;

  truncate table tmp_inventory_need;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) as t(value)
  loop
    v_item_key := nullif(trim(coalesce(v_item ->> 'id', '')), '');
    v_item_name := lower(trim(coalesce(v_item ->> 'name', '')));
    v_qty_text := trim(coalesce(v_item ->> 'quantity', '0'));

    if v_qty_text ~ '^-?[0-9]+(\.[0-9]+)?$' then
      v_item_qty := greatest(v_qty_text::numeric, 0);
    else
      v_item_qty := 0;
    end if;

    if v_item_qty <= 0 then
      continue;
    end if;

    select p.id
    into v_product_id
    from public.products p
    where p.is_active = true
      and (
        (v_item_key is not null and p.external_key = v_item_key)
        or (v_item_name <> '' and lower(p.name) = v_item_name)
      )
    order by case when v_item_key is not null and p.external_key = v_item_key then 0 else 1 end
    limit 1;

    if v_product_id is null then
      v_missing_products_count := v_missing_products_count + 1;
      continue;
    end if;

    insert into tmp_inventory_need (ingredient_id, qty)
    select
      r.ingredient_id,
      v_item_qty * r.qty_per_serving * (1 + coalesce(r.waste_factor, 0))
    from public.product_recipes r
    where r.product_id = v_product_id
      and r.is_active = true
    on conflict (ingredient_id) do update
    set qty = tmp_inventory_need.qty + excluded.qty;
  end loop;

  for v_need in
    select ingredient_id, qty
    from tmp_inventory_need
    where qty > 0
  loop
    if exists (
      select 1
      from public.inventory_movements m
      where m.reference_order_id = p_order_id
        and m.branch_id = v_branch_id
        and m.ingredient_id = v_need.ingredient_id
        and m.movement_type = 'sale_consume'
    ) then
      v_duplicate_count := v_duplicate_count + 1;
      continue;
    end if;

    perform movement_id
    from public.inventory_apply_movement(
      p_ingredient_id => v_need.ingredient_id,
      p_branch_id => v_branch_id,
      p_quantity_delta => -v_need.qty,
      p_movement_type => 'sale_consume',
      p_reference_order_id => p_order_id,
      p_actor_user_id => p_actor_user_id,
      p_metadata => jsonb_build_object(
        'source', coalesce(nullif(trim(coalesce(p_source, '')), ''), 'manual'),
        'orderId', p_order_id
      )
    );

    v_consumed_count := v_consumed_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'orderId', p_order_id,
    'branchId', v_branch_id,
    'consumedIngredientCount', v_consumed_count,
    'missingProductsCount', v_missing_products_count,
    'alreadyConsumedCount', v_duplicate_count
  );
end;
$$;

revoke all on function public.consume_stock_for_order(bigint, uuid, text) from public;
grant execute on function public.consume_stock_for_order(bigint, uuid, text) to authenticated;

create or replace function public.trg_auto_consume_stock_on_order_served()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and coalesce(new.status, '') = 'served'
    and coalesce(old.status, '') <> 'served'
    and public.inventory_module_enabled()
  then
    perform public.consume_stock_for_order(new.id, auth.uid(), 'auto-trigger');
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'cafe_orders'
  ) then
    execute 'alter table public.cafe_orders add column if not exists branch_id text references public.erp_branches(id) on delete set null';
    execute 'update public.cafe_orders set branch_id = ''main'' where branch_id is null';
    execute 'create index if not exists idx_cafe_orders_branch_created on public.cafe_orders (branch_id, created_at desc)';

    if not exists (select 1 from pg_trigger where tgname = 'trg_cafe_orders_auto_consume_stock') then
      execute 'create trigger trg_cafe_orders_auto_consume_stock after update on public.cafe_orders for each row execute function public.trg_auto_consume_stock_on_order_served()';
    end if;
  end if;
end
$$;
