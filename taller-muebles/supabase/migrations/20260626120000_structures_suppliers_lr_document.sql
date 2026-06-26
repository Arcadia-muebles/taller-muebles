alter table public.orders
add column if not exists seller_name text,
add column if not exists payment_method text,
add column if not exists delivery_terms text;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'structure_request_status') then
    create type public.structure_request_status as enum ('draft', 'requested', 'in_progress', 'done', 'cancelled');
  end if;
end $$;

create table if not exists public.structure_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  specifications text not null,
  status public.structure_request_status not null default 'requested',
  assigned_to text,
  requested_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists structure_requests_order_idx
on public.structure_requests (order_id);

create index if not exists structure_requests_status_idx
on public.structure_requests (status);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  products text not null default '',
  observations text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_active_name_idx
on public.suppliers (active, name);

drop trigger if exists structure_requests_touch_updated_at on public.structure_requests;
create trigger structure_requests_touch_updated_at
before update on public.structure_requests
for each row execute function app_private.touch_updated_at();

drop trigger if exists suppliers_touch_updated_at on public.suppliers;
create trigger suppliers_touch_updated_at
before update on public.suppliers
for each row execute function app_private.touch_updated_at();

alter table public.structure_requests enable row level security;
alter table public.suppliers enable row level security;

drop policy if exists "structure requests readable by active users" on public.structure_requests;
create policy "structure requests readable by active users"
on public.structure_requests for select
using (app_private.current_profile_id() is not null);

drop policy if exists "structure requests managed by admin and managers" on public.structure_requests;
create policy "structure requests managed by admin and managers"
on public.structure_requests for all
using (app_private.is_admin_or_manager())
with check (app_private.is_admin_or_manager());

drop policy if exists "suppliers readable by active users" on public.suppliers;
create policy "suppliers readable by active users"
on public.suppliers for select
using (app_private.current_profile_id() is not null);

drop policy if exists "suppliers managed by admin and managers" on public.suppliers;
create policy "suppliers managed by admin and managers"
on public.suppliers for all
using (app_private.is_admin_or_manager())
with check (app_private.is_admin_or_manager());

grant select, insert, update on public.structure_requests to authenticated;
grant select, insert, update on public.suppliers to authenticated;

grant update (
  seller_name,
  payment_method,
  delivery_terms
) on public.orders to authenticated;
