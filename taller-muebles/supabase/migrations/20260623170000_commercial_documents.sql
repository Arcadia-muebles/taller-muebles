alter table public.orders
add column if not exists document_type text not null default 'sales_note',
add column if not exists document_status text not null default 'issued',
add column if not exists customer_contact text,
add column if not exists customer_address text,
add column if not exists customer_commune text,
add column if not exists customer_rut text,
add column if not exists customer_email text,
add column if not exists customer_phone text,
add column if not exists quantity numeric(12, 2) default 1,
add column if not exists unit_price numeric(12, 2),
add column if not exists subtotal_amount numeric(12, 2),
add column if not exists discount_amount numeric(12, 2) not null default 0,
add column if not exists total_amount numeric(12, 2),
add column if not exists paid_amount numeric(12, 2) not null default 0,
add column if not exists balance_amount numeric(12, 2);

update public.orders
set document_type = case
  when stores.code = 'LH' then 'production_intake'
  when orders.is_warranty then 'warranty'
  else 'sales_note'
end
from public.stores
where orders.store_id = stores.id
  and orders.document_type = 'sales_note';

update public.orders
set balance_amount = greatest(coalesce(total_amount, 0) - coalesce(paid_amount, 0), 0)
where balance_amount is null
  and total_amount is not null;

alter table public.orders
drop constraint if exists orders_document_type_check,
add constraint orders_document_type_check
check (document_type in ('sales_note', 'quote', 'purchase_order', 'warranty', 'production_intake'));

alter table public.orders
drop constraint if exists orders_document_status_check,
add constraint orders_document_status_check
check (document_status in ('draft', 'issued', 'approved', 'closed', 'cancelled'));

create index if not exists orders_document_type_idx
on public.orders (document_type);

create index if not exists orders_document_status_idx
on public.orders (document_status);

grant update (
  document_type,
  document_status,
  customer_contact,
  customer_address,
  customer_commune,
  customer_rut,
  customer_email,
  customer_phone,
  quantity,
  unit_price,
  subtotal_amount,
  discount_amount,
  total_amount,
  paid_amount,
  balance_amount
) on public.orders to authenticated;
