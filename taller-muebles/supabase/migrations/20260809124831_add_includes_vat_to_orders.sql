alter table public.orders
add column if not exists includes_vat boolean not null default true;

grant update (includes_vat) on public.orders to authenticated;
