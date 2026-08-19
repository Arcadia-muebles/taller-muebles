alter table public.orders
  add column product_position integer;

with positioned_orders as (
  select
    id,
    (row_number() over (
      partition by store_id, coalesce(nullif(group_code, ''), internal_code)
      order by created_at, id
    ))::integer as product_position
  from public.orders
)
update public.orders as orders
set product_position = positioned_orders.product_position
from positioned_orders
where positioned_orders.id = orders.id;

alter table public.orders
  alter column product_position set default 1,
  alter column product_position set not null,
  add constraint orders_product_position_positive check (product_position > 0);
