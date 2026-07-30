-- Estructura, corte y costura son frentes de trabajo independientes.
-- Un operario debe poder ver una orden cuando su propia etapa está disponible,
-- aunque otra de estas tres etapas todavía no haya terminado.
create or replace function app_private.can_access_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when app_private.current_profile_id() is null then false
      when app_private.current_role() <> 'operator' then true
      else
        exists (
          select 1
          from public.orders o
          where o.id = target_order_id
            and o.created_by = app_private.current_profile_id()
        )
        or exists (
          select 1
          from public.production_steps own_actionable_step
          where own_actionable_step.order_id = target_order_id
            and own_actionable_step.step = any(app_private.current_areas())
            and (
              own_actionable_step.status in ('active', 'blocked')
              or (
                own_actionable_step.status = 'pending'
                and (
                  own_actionable_step.step in ('structure', 'cutting', 'sewing')
                  or not exists (
                    select 1
                    from public.production_steps previous_step
                    where previous_step.order_id = own_actionable_step.order_id
                      and previous_step.sort_order < own_actionable_step.sort_order
                      and previous_step.status <> 'done'
                  )
                )
              )
            )
        )
        or exists (
          select 1
          from public.production_steps own_step
          where own_step.order_id = target_order_id
            and own_step.step = any(app_private.current_areas())
            and own_step.status = 'done'
            and own_step.completed_at >= now() - interval '30 minutes'
            and not exists (
              select 1
              from public.production_steps later_step
              where later_step.order_id = own_step.order_id
                and later_step.sort_order > own_step.sort_order
                and (
                  later_step.status <> 'pending'
                  or later_step.started_at is not null
                  or later_step.completed_at is not null
                )
            )
        )
    end,
    false
  )
$$;

revoke all on function app_private.can_access_order(uuid) from public;
grant execute on function app_private.can_access_order(uuid) to authenticated;
