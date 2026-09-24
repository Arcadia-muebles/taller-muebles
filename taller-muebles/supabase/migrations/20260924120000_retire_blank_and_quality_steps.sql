-- Ejecutar en el proyecto correcto, desde SQL Editor.
-- No elimina órdenes ni etapas: conserva las etapas retiradas en production_steps.
-- La tabla privada guarda además una copia del estado original de cada etapa.
begin;

-- Abortamos antes de cambiar datos si una orden afectada no tiene ninguna
-- etapa que pueda reemplazar a las retiradas.
do $$
begin
  if exists (
    select 1
    from public.orders as orders
    where exists (
      select 1 from public.production_steps as step
      where step.order_id = orders.id and step.step in ('en_blanco', 'quality')
    )
      and not exists (
        select 1 from public.production_steps as step
        where step.order_id = orders.id and step.step not in ('en_blanco', 'quality')
      )
  ) then
    raise exception 'Hay órdenes con sólo etapas retiradas. No se modificó ningún dato.';
  end if;
end $$;

create table if not exists app_private.retired_production_steps (
  id uuid primary key,
  order_id uuid not null,
  step text not null,
  record jsonb not null,
  retired_at timestamptz not null default now()
);

insert into app_private.retired_production_steps (id, order_id, step, record)
select id, order_id, step, to_jsonb(production_steps)
from public.production_steps
where step in ('en_blanco', 'quality')
  and sort_order >= 0
on conflict (id) do nothing;

insert into public.audit_logs (order_id, action, entity, entity_id, field_name, old_value, new_value)
select order_id, 'retire_production_step', 'production_steps', id, 'step', step, 'retired'
from public.production_steps
where step in ('en_blanco', 'quality')
  and sort_order >= 0;

-- Se conservan las filas originales. Estado done y orden negativo hacen que
-- las reglas existentes de precedencia y reversión ignoren estas etapas.
update public.production_steps
set status = 'done',
    sort_order = -100000 - abs(sort_order)
where step in ('en_blanco', 'quality')
  and sort_order >= 0;

with reordered as (
  select id, row_number() over (partition by order_id order by sort_order, id)::int as position
  from public.production_steps
  where step not in ('en_blanco', 'quality')
)
update public.production_steps as step
set sort_order = reordered.position
from reordered
where step.id = reordered.id and step.sort_order is distinct from reordered.position;

update public.system_settings
set value = jsonb_set(
      jsonb_set(
        jsonb_set(value, '{production,steps}',
          coalesce((
            select jsonb_agg(item order by ordinal)
            from jsonb_array_elements(
              case when jsonb_typeof(value #> '{production,steps}') = 'array'
                then value #> '{production,steps}' else '[]'::jsonb end
            ) with ordinality as source(item, ordinal)
            where item->>'key' not in ('en_blanco', 'quality')
          ), '[]'::jsonb), true),
        '{production,requireQualityApproval}', 'false'::jsonb, true),
      '{production,autoCompleteAfterQuality}', 'false'::jsonb, true),
    updated_at = now()
where id = true;

update public.profiles as profile
set area = (
  select string_agg(trim(part.value), ',' order by part.ordinal)
  from unnest(string_to_array(profile.area, ',')) with ordinality as part(value, ordinal)
  where trim(part.value) <> '' and trim(part.value) not in ('en_blanco', 'quality')
)
where profile.area is not null
  and exists (
    select 1 from unnest(string_to_array(profile.area, ',')) as part(value)
    where trim(part.value) in ('en_blanco', 'quality')
  );

update public.orders
set condition = 'none'
where condition = 'quality_control';

update public.orders as orders
set status = case
    when not exists (
      select 1 from public.production_steps as step
      where step.order_id = orders.id and step.step not in ('en_blanco', 'quality') and step.status <> 'done'
    ) then 'quality_control'::public.order_status
    when not exists (
      select 1 from public.production_steps as step
      where step.order_id = orders.id and step.step not in ('en_blanco', 'quality') and step.status <> 'pending'
    ) then 'scheduled'::public.order_status
    when orders.priority = 'critical' then 'urgent'::public.order_status
    else 'in_production'::public.order_status
  end
where orders.status in ('scheduled', 'in_production', 'urgent', 'quality_control', 'blocked')
  and exists (select 1 from public.production_steps as step where step.order_id = orders.id and step.step in ('en_blanco', 'quality'))
  and exists (select 1 from public.production_steps as step where step.order_id = orders.id and step.step not in ('en_blanco', 'quality'))
  and not exists (
    select 1 from public.production_steps as step
    where step.order_id = orders.id and step.step not in ('en_blanco', 'quality') and step.status = 'blocked'
  );

commit;
