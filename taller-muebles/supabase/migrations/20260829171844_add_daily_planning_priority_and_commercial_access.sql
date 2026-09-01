do $$
begin
  if not exists (select 1 from pg_type where typname = 'agenda_priority') then
    create type public.agenda_priority as enum ('low', 'normal', 'high', 'critical');
  end if;
end $$;

alter table public.agenda_items
add column if not exists priority public.agenda_priority not null default 'normal';

grant update (priority) on public.agenda_items to authenticated;

create or replace function app_private.has_module_access(module_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app_private.current_role() in ('admin', 'manager')
    or (
      app_private.current_role() = 'operator'
      and ('module_' || module_name) = any(app_private.current_areas())
    ),
    false
  )
$$;

revoke all on function app_private.has_module_access(text) from public;
grant execute on function app_private.has_module_access(text) to authenticated;

drop policy if exists "profiles readable by self and managers" on public.profiles;
create policy "profiles readable within role and module scope"
on public.profiles for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.is_admin_or_manager()
  or app_private.has_module_access('commercial')
);

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
      when app_private.has_module_access('commercial') then exists (
        select 1
        from public.orders commercial_order
        where commercial_order.id = target_order_id
          and commercial_order.document_type <> 'production_intake'
      )
      else
        exists (
          select 1
          from public.orders o
          where o.id = target_order_id
            and o.created_by = app_private.current_profile_id()
        )
        or exists (
          select 1
          from public.production_steps selected_step
          where selected_step.id = (
            select candidate.id
            from public.production_steps candidate
            where candidate.order_id = target_order_id
              and candidate.status in ('active', 'blocked', 'pending')
            order by
              case candidate.status
                when 'active' then 0
                when 'blocked' then 1
                else 2
              end,
              candidate.sort_order
            limit 1
          )
            and selected_step.step = any(app_private.current_areas())
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

drop policy if exists "orders updated by admins and managers" on public.orders;
drop policy if exists "orders updated within commercial scope" on public.orders;
create policy "orders updated within commercial scope"
on public.orders for update
to authenticated
using (
  app_private.is_admin_or_manager()
  or (
    app_private.has_module_access('commercial')
    and document_type <> 'production_intake'
  )
)
with check (
  app_private.is_admin_or_manager()
  or (
    app_private.has_module_access('commercial')
    and document_type <> 'production_intake'
  )
);

drop policy if exists "order payments readable by active users" on public.order_payments;
create policy "order payments readable within order scope"
on public.order_payments for select
to authenticated
using (app_private.can_access_order(order_id));

drop policy if exists "order payments managed by admin and managers" on public.order_payments;
create policy "order payments inserted within commercial scope"
on public.order_payments for insert
to authenticated
with check (
  app_private.has_module_access('commercial')
  and app_private.can_access_order(order_id)
);

drop policy if exists "order payments updated by admin and managers" on public.order_payments;
create policy "order payments updated within commercial scope"
on public.order_payments for update
to authenticated
using (
  app_private.has_module_access('commercial')
  and app_private.can_access_order(order_id)
)
with check (
  app_private.has_module_access('commercial')
  and app_private.can_access_order(order_id)
);

drop policy if exists "order payments deleted by admin and managers" on public.order_payments;
create policy "order payments deleted within commercial scope"
on public.order_payments for delete
to authenticated
using (
  app_private.has_module_access('commercial')
  and app_private.can_access_order(order_id)
);

notify pgrst, 'reload schema';
