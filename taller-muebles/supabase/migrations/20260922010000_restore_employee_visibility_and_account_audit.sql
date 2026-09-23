-- Reading an assigned order includes planning and history; changing a step
-- remains a separate authorization decision in the production action.
create or replace function app_private.can_access_order(target_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    app_private.current_profile_id() is not null
    and (
      app_private.is_admin_or_manager()
      or (
        app_private.current_role() = 'operator'
        and exists (
          select 1 from public.orders o
          where o.id = target_order_id
            and (
              (app_private.has_module_access('commercial') and o.document_type <> 'production_intake')
              or o.created_by = app_private.current_profile_id()
              or (
                o.document_type <> 'quote'
                and o.status <> 'cancelled'
                and exists (
                  select 1 from public.production_steps s
                  where s.order_id = o.id
                    and s.step = any(app_private.current_areas())
                    and (o.status <> 'completed' or s.status = 'done')
                )
              )
            )
        )
      )
    ), false
  )
$$;

revoke all on function app_private.can_access_order(uuid) from public;
grant execute on function app_private.can_access_order(uuid) to authenticated;

create or replace function app_private.manager_can_edit_orders()
returns boolean language sql stable security definer set search_path = ''
as $$
  select app_private.current_role() = 'manager'
    and coalesce((select (value #>> '{permissions,managersCanEditOrders}')::boolean
      from public.system_settings where id = true), true)
$$;
revoke all on function app_private.manager_can_edit_orders() from public;
grant execute on function app_private.manager_can_edit_orders() to authenticated;

-- Operators use the validated server action (with its server-only client).
-- Direct updates would bypass transition, timing and configurable permissions.
drop policy if exists "production steps updated within role scope" on public.production_steps;
create policy "production steps updated within role scope"
on public.production_steps for update to authenticated
using (
  (app_private.current_role() = 'admin' or app_private.manager_can_edit_orders())
  and exists (select 1 from public.orders o where o.id = order_id and o.status not in ('completed', 'cancelled'))
)
with check (
  updated_by = app_private.current_profile_id()
  and (app_private.current_role() = 'admin' or app_private.manager_can_edit_orders())
);

drop policy if exists "orders updated within commercial scope" on public.orders;
create policy "orders updated within commercial scope"
on public.orders for update to authenticated
using (
  app_private.current_role() = 'admin' or app_private.manager_can_edit_orders()
  or (app_private.current_role() = 'operator' and app_private.has_module_access('commercial') and document_type <> 'production_intake')
)
with check (
  app_private.current_role() = 'admin' or app_private.manager_can_edit_orders()
  or (app_private.current_role() = 'operator' and app_private.has_module_access('commercial') and document_type <> 'production_intake')
);

-- Workshop access must not grant access to payment records.
drop policy if exists "order payments readable within order scope" on public.order_payments;
create policy "order payments readable within order scope"
on public.order_payments for select to authenticated
using (app_private.has_module_access('commercial') and app_private.can_access_order(order_id));

-- Write profiles with the administrator's session, so RLS and audit identify
-- the actor. Auth account provisioning still uses the server-only admin client.
grant insert (user_id, full_name, role, area) on public.profiles to authenticated;
grant update (full_name, role, area, active) on public.profiles to authenticated;

create or replace function app_private.guard_internal_profile_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.user_id = auth.uid() and old.role = 'admin'
    and (new.role <> 'admin' or not new.active) then
    raise exception 'No puedes quitarte el acceso de administrador.';
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_internal_profile_change() from public, anon, authenticated;
create trigger guard_internal_profile_change before update on public.profiles
for each row execute function app_private.guard_internal_profile_change();

create or replace function app_private.audit_internal_profile_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  previous_value text;
  next_value text;
begin
  next_value := jsonb_build_object('name', new.full_name, 'role', new.role, 'areas', new.area, 'active', new.active)::text;
  if tg_op = 'UPDATE' then
    previous_value := jsonb_build_object('name', old.full_name, 'role', old.role, 'areas', old.area, 'active', old.active)::text;
    if previous_value = next_value then return new; end if;
  end if;
  insert into public.audit_logs (entity, entity_id, profile_id, action, old_value, new_value)
  values ('profiles', new.id, app_private.current_profile_id(),
    case when tg_op = 'INSERT' then 'create_user' else 'update_user' end,
    previous_value, next_value);
  return new;
end;
$$;
revoke all on function app_private.audit_internal_profile_change() from public, anon, authenticated;
create trigger audit_internal_profile_change after insert or update on public.profiles
for each row execute function app_private.audit_internal_profile_change();

create policy "account audit readable by admins"
on public.audit_logs for select to authenticated
using (entity = 'profiles' and app_private.current_role() = 'admin');

notify pgrst, 'reload schema';
