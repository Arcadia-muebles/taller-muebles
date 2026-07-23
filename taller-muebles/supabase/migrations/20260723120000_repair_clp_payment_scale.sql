-- Corrige abonos creados desde campos CLP formateados (por ejemplo, "500.000")
-- que fueron interpretados como 500 al persistir el historial.
with affected_orders as (
  select
    o.id,
    o.paid_amount,
    sum(op.amount) as history_total
  from public.orders o
  join public.order_payments op on op.order_id = o.id
  group by o.id, o.paid_amount, o.total_amount
  having
    sum(op.amount) > 0
    and sum(op.amount) * 1000 = o.paid_amount
    and (o.total_amount is null or o.paid_amount <= o.total_amount)
)
update public.order_payments op
set amount = op.amount * 1000
from affected_orders affected
where op.order_id = affected.id;
