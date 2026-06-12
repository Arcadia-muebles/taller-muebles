create extension if not exists pgcrypto;

create schema if not exists app_private;

create type public.user_role as enum ('admin', 'manager', 'operator', 'viewer');
create type public.store_code as enum ('LH', 'LR');
create type public.order_status as enum (
  'draft',
  'scheduled',
  'in_production',
  'blocked',
  'urgent',
  'quality_control',
  'completed',
  'cancelled'
);
create type public.order_condition as enum (
  'none',
  'warehouse',
  'showroom',
  'loaned',
  'quality_control',
  'delivered'
);
create type public.priority_level as enum ('normal', 'high', 'critical');
create type public.step_status as enum ('pending', 'active', 'done', 'blocked');
create type public.stock_movement_type as enum ('in', 'out', 'adjustment', 'reserved', 'released');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code public.store_code not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  full_name text not null,
  role public.user_role not null default 'operator',
  area text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  internal_code text not null,
  sales_note_number text,
  client_name text not null,
  product_name text not null,
  material text,
  color text,
  status public.order_status not null default 'scheduled',
  condition public.order_condition not null default 'none',
  priority public.priority_level not null default 'normal',
  is_warranty boolean not null default false,
  entry_date date not null default current_date,
  delivery_date date,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  width integer,
  depth integer,
  height integer,
  observations text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, internal_code)
);

create table public.production_steps (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  step text not null,
  step_label text not null,
  sort_order int not null,
  status public.step_status not null default 'pending',
  assigned_to uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  blocked_reason text,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, step)
);

create table public.order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.order_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  name text not null,
  category text not null,
  unit text not null,
  current_quantity numeric(12, 2) not null default 0,
  minimum_quantity numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  movement_type public.stock_movement_type not null,
  quantity numeric(12, 2) not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table public.system_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index orders_store_status_idx on public.orders (store_id, status);
create index orders_delivery_date_idx on public.orders (delivery_date) where completed_at is null;
create index orders_client_name_idx on public.orders using gin (to_tsvector('spanish', client_name));
create index production_steps_order_idx on public.production_steps (order_id, sort_order);
create index production_steps_status_idx on public.production_steps (step, status);
create index stock_movements_material_created_idx on public.stock_movements (material_id, created_at desc);

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function app_private.touch_updated_at();

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function app_private.touch_updated_at();

create trigger production_steps_touch_updated_at
before update on public.production_steps
for each row execute function app_private.touch_updated_at();

create trigger materials_touch_updated_at
before update on public.materials
for each row execute function app_private.touch_updated_at();

create or replace function app_private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function app_private.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function app_private.current_area()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select area
  from public.profiles
  where user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function app_private.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_private.current_role() in ('admin', 'manager'), false)
$$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.current_profile_id() from public;
revoke all on function app_private.current_role() from public;
revoke all on function app_private.current_area() from public;
revoke all on function app_private.is_admin_or_manager() from public;
grant execute on function app_private.current_profile_id() to authenticated;
grant execute on function app_private.current_role() to authenticated;
grant execute on function app_private.current_area() to authenticated;
grant execute on function app_private.is_admin_or_manager() to authenticated;

create or replace function public.record_stock_movement(
  p_material_id uuid,
  p_movement_type public.stock_movement_type,
  p_quantity numeric,
  p_notes text default null,
  p_order_id uuid default null
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_value numeric;
  next_value numeric;
begin
  if not app_private.is_admin_or_manager() then
    raise exception 'Insufficient permissions';
  end if;
  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Unsupported stock movement type';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select current_quantity into current_value
  from public.materials
  where id = p_material_id
  for update;

  if current_value is null then
    raise exception 'Material not found';
  end if;

  next_value := case
    when p_movement_type = 'in' then current_value + p_quantity
    when p_movement_type = 'out' then current_value - p_quantity
    when p_movement_type = 'adjustment' then p_quantity
    else current_value
  end;

  if next_value < 0 then
    raise exception 'Insufficient stock';
  end if;

  update public.materials set current_quantity = next_value where id = p_material_id;
  insert into public.stock_movements (material_id, order_id, movement_type, quantity, notes, created_by)
  values (p_material_id, p_order_id, p_movement_type, p_quantity, p_notes, app_private.current_profile_id());
  return next_value;
end;
$$;

revoke all on function public.record_stock_movement(uuid, public.stock_movement_type, numeric, text, uuid)
from public;
grant execute on function public.record_stock_movement(uuid, public.stock_movement_type, numeric, text, uuid)
to authenticated;

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.production_steps enable row level security;
alter table public.order_comments enable row level security;
alter table public.order_attachments enable row level security;
alter table public.materials enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy "stores readable by active users"
on public.stores for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "profiles readable by self and managers"
on public.profiles for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.is_admin_or_manager()
);

create policy "profiles managed by admins"
on public.profiles for all
to authenticated
using (app_private.current_role() = 'admin')
with check (app_private.current_role() = 'admin');

create policy "orders readable by active users"
on public.orders for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "orders inserted by active users"
on public.orders for insert
to authenticated
with check (
  app_private.current_profile_id() is not null
  and created_by = app_private.current_profile_id()
);

create policy "orders updated by admins and managers"
on public.orders for update
to authenticated
using (app_private.is_admin_or_manager())
with check (app_private.is_admin_or_manager());

create policy "production steps readable by active users"
on public.production_steps for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "production steps inserted by active users"
on public.production_steps for insert
to authenticated
with check (app_private.current_profile_id() is not null);

create policy "production steps updated by active users"
on public.production_steps for update
to authenticated
using (app_private.current_profile_id() is not null)
with check (
  app_private.current_profile_id() is not null
  and updated_by = app_private.current_profile_id()
);

create policy "comments readable by active users"
on public.order_comments for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "comments inserted by active users"
on public.order_comments for insert
to authenticated
with check (profile_id = app_private.current_profile_id());

create policy "attachments readable by active users"
on public.order_attachments for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "attachments inserted by active users"
on public.order_attachments for insert
to authenticated
with check (uploaded_by = app_private.current_profile_id());

create policy "materials readable by active users"
on public.materials for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "materials managed by admins and managers"
on public.materials for all
to authenticated
using (app_private.is_admin_or_manager())
with check (app_private.is_admin_or_manager());

create policy "stock movements readable by active users"
on public.stock_movements for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "stock movements inserted by admins and managers"
on public.stock_movements for insert
to authenticated
with check (app_private.is_admin_or_manager());

create policy "audit logs readable by active users"
on public.audit_logs for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "audit logs inserted by active users"
on public.audit_logs for insert
to authenticated
with check (profile_id = app_private.current_profile_id());

create policy "system settings readable by active users"
on public.system_settings for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "system settings managed by admins"
on public.system_settings for all
to authenticated
using (app_private.current_role() = 'admin')
with check (
  app_private.current_role() = 'admin'
  and updated_by = app_private.current_profile_id()
);

grant usage on schema public to authenticated;
grant select on public.stores to authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.orders to authenticated;
grant update (
  store_id,
  internal_code,
  sales_note_number,
  client_name,
  product_name,
  material,
  color,
  status,
  condition,
  priority,
  is_warranty,
  entry_date,
  delivery_date,
  completed_at,
  assigned_to,
  observations
) on public.orders to authenticated;
grant select, insert on public.production_steps to authenticated;
grant update (status, started_at, completed_at, blocked_reason, notes, updated_by)
on public.production_steps to authenticated;
grant select, insert on public.order_comments to authenticated;
grant select, insert on public.order_attachments to authenticated;
grant select, insert, update on public.materials to authenticated;
grant select, insert on public.stock_movements to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update on public.system_settings to authenticated;

grant usage on schema public, app_private to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema app_private to service_role;

insert into storage.buckets (id, name, public)
values ('order-attachments', 'order-attachments', false)
on conflict (id) do nothing;

create policy "order attachments storage readable by active users"
on storage.objects for select
to authenticated
using (
  bucket_id = 'order-attachments'
  and app_private.current_profile_id() is not null
);

create policy "order attachments storage uploaded by active users"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'order-attachments'
  and app_private.current_profile_id() is not null
);

insert into public.stores (code, name)
values
  ('LH', 'Leather House'),
  ('LR', 'La Reina')
on conflict (code) do nothing;

insert into public.materials (name, category, unit, current_quantity, minimum_quantity)
values
  ('Cuero Riga Honey', 'Cuero', 'm2', 28, 18),
  ('Cuero Waxy Camel', 'Cuero', 'm2', 12, 16),
  ('Madera nogal', 'Estructura', 'tablas', 42, 20),
  ('Espuma alta densidad', 'Relleno', 'planchas', 9, 12);
