create or replace function app_private.client_portal_key(
  p_store_id uuid,
  p_internal_code text,
  p_group_code text,
  p_customer_rut text,
  p_customer_email text,
  p_customer_phone text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when length(regexp_replace(upper(coalesce(p_customer_rut, '')), '[^0-9K]', '', 'g')) >= 8
      then 'rut:' || regexp_replace(upper(p_customer_rut), '[^0-9K]', '', 'g')
    when nullif(lower(trim(coalesce(p_customer_email, ''))), '') is not null
      then 'email:' || lower(trim(p_customer_email))
    when length(regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g')) >= 8
      then 'phone:' || regexp_replace(p_customer_phone, '[^0-9]', '', 'g')
    else 'order:' || p_store_id::text || ':' || coalesce(nullif(trim(p_group_code), ''), p_internal_code)
  end;
$$;

revoke all on function app_private.client_portal_key(uuid, text, text, text, text, text)
from public, anon, authenticated;

create or replace function public.get_client_portal_orders(p_token_hash text)
returns table (
  link_order_id uuid,
  order_id uuid,
  internal_code text,
  group_code text,
  store_id uuid,
  client_name text,
  document_type text,
  product_name text,
  color text,
  quantity numeric,
  status text,
  entry_date date,
  delivery_date date,
  store_code text,
  production_steps jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    links.order_id as link_order_id,
    orders.id as order_id,
    orders.internal_code,
    orders.group_code,
    orders.store_id,
    orders.client_name,
    orders.document_type,
    orders.product_name,
    orders.color,
    orders.quantity,
    orders.status::text,
    orders.entry_date,
    orders.delivery_date,
    stores.code::text as store_code,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'step', steps.step,
            'step_label', steps.step_label,
            'status', steps.status::text,
            'sort_order', steps.sort_order
          )
          order by steps.sort_order
        )
        from public.production_steps as steps
        where steps.order_id = orders.id
      ),
      '[]'::jsonb
    ) as production_steps
  from public.client_portal_links as links
  join public.orders as orders
    on app_private.client_portal_key(
      orders.store_id,
      orders.internal_code,
      orders.group_code,
      orders.customer_rut,
      orders.customer_email,
      orders.customer_phone
    ) = links.client_key
  join public.stores as stores on stores.id = orders.store_id
  where p_token_hash ~ '^[0-9a-f]{64}$'
    and links.token_hash = p_token_hash
    and links.revoked_at is null
    and links.expires_at > now()
    and orders.document_type <> 'quote'
  order by orders.entry_date desc, orders.internal_code, orders.id;
$$;

revoke all on function public.get_client_portal_orders(text)
from public, anon, authenticated;

grant execute on function public.get_client_portal_orders(text)
to anon, service_role;

comment on function public.get_client_portal_orders(text) is
'Token-gated public portal query. Returns only the minimal order and production fields approved for client tracking.';
