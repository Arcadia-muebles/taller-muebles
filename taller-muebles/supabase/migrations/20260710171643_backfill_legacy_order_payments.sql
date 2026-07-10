-- Convierte los abonos acumulados anteriores a order_payments en filas historicas.
-- Es idempotente: solo agrega la diferencia que aun no existe en el historial.
insert into public.order_payments (order_id, paid_at, amount, method, note)
select
  o.id,
  o.entry_date,
  o.paid_amount - coalesce(p.history_total, 0),
  'Abono anterior',
  'Migrado desde el total abonado existente al crear el historial de pagos.'
from public.orders o
left join lateral (
  select sum(op.amount) as history_total
  from public.order_payments op
  where op.order_id = o.id
) p on true
where coalesce(o.paid_amount, 0) > coalesce(p.history_total, 0);
