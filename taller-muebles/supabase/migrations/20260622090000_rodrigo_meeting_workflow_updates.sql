alter table public.orders
add column if not exists group_code text;

alter table public.orders
drop constraint if exists orders_store_id_internal_code_key;

update public.orders
set group_code = internal_code
where group_code is null;

alter table public.orders
alter column group_code set not null,
alter column group_code set default '';

create index if not exists orders_group_code_idx
on public.orders (group_code);

create index if not exists orders_store_internal_code_idx
on public.orders (store_id, internal_code);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'stock_location') then
    create type public.stock_location as enum ('warehouse', 'workshop');
  end if;
end $$;

alter table public.materials
add column if not exists location public.stock_location not null default 'warehouse';

create index if not exists materials_location_idx
on public.materials (location);

grant update (group_code) on public.orders to authenticated;
grant update (location) on public.materials to authenticated;
