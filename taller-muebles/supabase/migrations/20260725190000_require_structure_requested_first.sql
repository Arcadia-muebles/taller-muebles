-- Preserve active legacy work when "Pedida" becomes the mandatory first gate.
-- Future orders cannot reach a production check without passing this gate.
insert into public.structure_requests (
  order_id,
  specifications,
  status,
  requested_at
)
select
  orders.id,
  coalesce(nullif(trim(orders.product_name), ''), 'Estructura asociada a la orden'),
  'requested'::public.structure_request_status,
  now()
from public.orders
where orders.status not in ('completed', 'cancelled')
  and exists (
    select 1
    from public.production_steps
    where production_steps.order_id = orders.id
      and production_steps.step = 'structure'
  )
  and exists (
    select 1
    from public.production_steps
    where production_steps.order_id = orders.id
      and production_steps.status = 'done'
  )
  and not exists (
    select 1
    from public.structure_requests
    where structure_requests.order_id = orders.id
      and structure_requests.status <> 'cancelled'
  );
