alter table public.client_portal_links
add column if not exists client_key text;

update public.client_portal_links links
set client_key = case
  when length(regexp_replace(upper(coalesce(orders.customer_rut, '')), '[^0-9K]', '', 'g')) >= 8
    then 'rut:' || regexp_replace(upper(orders.customer_rut), '[^0-9K]', '', 'g')
  when nullif(lower(trim(coalesce(orders.customer_email, ''))), '') is not null
    then 'email:' || lower(trim(orders.customer_email))
  when length(regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9]', '', 'g')) >= 8
    then 'phone:' || regexp_replace(orders.customer_phone, '[^0-9]', '', 'g')
  else 'order:' || orders.store_id::text || ':' || coalesce(nullif(trim(orders.group_code), ''), orders.internal_code)
end
from public.orders
where links.order_id = orders.id
  and links.client_key is null;

alter table public.client_portal_links
alter column client_key set not null;

alter table public.client_portal_links
drop constraint if exists client_portal_links_client_key_not_blank,
add constraint client_portal_links_client_key_not_blank
check (length(trim(client_key)) between 8 and 240);

with duplicate_active_links as (
  select
    id,
    row_number() over (
      partition by client_key
      order by created_at desc, id desc
    ) as position
  from public.client_portal_links
  where revoked_at is null
)
update public.client_portal_links links
set revoked_at = now()
from duplicate_active_links duplicates
where links.id = duplicates.id
  and duplicates.position > 1;

drop index if exists public.client_portal_links_one_active_per_order;

create unique index if not exists client_portal_links_one_active_per_client
on public.client_portal_links(client_key)
where revoked_at is null;

create index if not exists client_portal_links_client_lookup
on public.client_portal_links(client_key)
where revoked_at is null;

comment on column public.client_portal_links.client_key is
'Canonical customer identity used to scope one revocable portal link across that customer orders. Falls back to one sales note when no reliable identifier exists.';
