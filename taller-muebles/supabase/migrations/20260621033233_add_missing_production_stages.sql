update public.production_steps
set sort_order = case step
  when 'structure' then 1
  when 'en_blanco' then 2
  when 'cutting' then 3
  when 'sewing' then 4
  when 'upholstery' then 5
  when 'quality' then 6
  when 'dispatch' then 7
  else sort_order
end
where step in ('structure', 'en_blanco', 'cutting', 'sewing', 'upholstery', 'quality', 'dispatch');

insert into public.production_steps (
  order_id, step, step_label, sort_order, status, notes, work_sessions
)
select
  orders.id,
  'en_blanco',
  'En Blanco',
  2,
  case
    when orders.status = 'completed' then 'done'::public.step_status
    when exists (
      select 1
      from public.production_steps later
      where later.order_id = orders.id
        and later.step in ('cutting', 'sewing', 'upholstery', 'quality', 'dispatch')
        and later.status in ('active', 'done', 'blocked')
    ) then 'done'::public.step_status
    else 'pending'::public.step_status
  end,
  null,
  '[]'::jsonb
from public.orders
where not exists (
  select 1
  from public.production_steps existing
  where existing.order_id = orders.id
    and existing.step = 'en_blanco'
);

insert into public.production_steps (
  order_id, step, step_label, sort_order, status, notes, work_sessions
)
select
  orders.id,
  'dispatch',
  'Despacho',
  7,
  case
    when orders.status = 'completed' then 'done'::public.step_status
    else 'pending'::public.step_status
  end,
  null,
  '[]'::jsonb
from public.orders
where not exists (
  select 1
  from public.production_steps existing
  where existing.order_id = orders.id
    and existing.step = 'dispatch'
);
