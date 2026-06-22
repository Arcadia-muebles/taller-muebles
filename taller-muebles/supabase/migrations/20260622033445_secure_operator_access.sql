create or replace function app_private.current_areas()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    regexp_split_to_array(nullif(trim(p.area), ''), '\s*,\s*'),
    array[]::text[]
  )
  from public.profiles p
  where p.user_id = auth.uid()
    and p.active = true
  limit 1
$$;

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

create or replace function app_private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function app_private.current_areas() from public;
revoke all on function app_private.can_access_order(uuid) from public;
revoke all on function app_private.try_uuid(text) from public;
grant execute on function app_private.current_areas() to authenticated;
grant execute on function app_private.can_access_order(uuid) to authenticated;
grant execute on function app_private.try_uuid(text) to authenticated;

drop policy if exists "orders readable by active users" on public.orders;
create policy "orders readable within role scope"
on public.orders for select
to authenticated
using (app_private.can_access_order(id));

drop policy if exists "orders inserted by active users" on public.orders;
create policy "orders inserted by operational users"
on public.orders for insert
to authenticated
with check (
  app_private.current_role() in ('admin', 'manager', 'operator')
  and created_by = app_private.current_profile_id()
);

drop policy if exists "production steps readable by active users" on public.production_steps;
create policy "production steps readable within order scope"
on public.production_steps for select
to authenticated
using (app_private.can_access_order(order_id));

drop policy if exists "production steps inserted by active users" on public.production_steps;
create policy "production steps inserted by operational users"
on public.production_steps for insert
to authenticated
with check (
  app_private.is_admin_or_manager()
  or exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.created_by = app_private.current_profile_id()
  )
);

drop policy if exists "production steps updated by active users" on public.production_steps;
create policy "production steps updated within role scope"
on public.production_steps for update
to authenticated
using (
  app_private.is_admin_or_manager()
  or (
    app_private.current_role() = 'operator'
    and step = any(app_private.current_areas())
  )
)
with check (
  updated_by = app_private.current_profile_id()
  and (
    app_private.is_admin_or_manager()
    or (
      app_private.current_role() = 'operator'
      and step = any(app_private.current_areas())
    )
  )
);

drop policy if exists "comments readable by active users" on public.order_comments;
create policy "comments readable within order scope"
on public.order_comments for select
to authenticated
using (app_private.can_access_order(order_id));

drop policy if exists "comments inserted by active users" on public.order_comments;
create policy "comments inserted within order scope"
on public.order_comments for insert
to authenticated
with check (
  app_private.current_role() in ('admin', 'manager', 'operator')
  and profile_id = app_private.current_profile_id()
  and app_private.can_access_order(order_id)
);

drop policy if exists "attachments readable by active users" on public.order_attachments;
create policy "attachments readable within order scope"
on public.order_attachments for select
to authenticated
using (app_private.can_access_order(order_id));

drop policy if exists "attachments inserted by active users" on public.order_attachments;
create policy "attachments inserted within order scope"
on public.order_attachments for insert
to authenticated
with check (
  app_private.current_role() in ('admin', 'manager', 'operator')
  and uploaded_by = app_private.current_profile_id()
  and app_private.can_access_order(order_id)
);

drop policy if exists "audit logs readable by active users" on public.audit_logs;
create policy "audit logs readable within order scope"
on public.audit_logs for select
to authenticated
using (order_id is not null and app_private.can_access_order(order_id));

drop policy if exists "order attachments storage readable by active users" on storage.objects;
create policy "order attachments storage readable within order scope"
on storage.objects for select
to authenticated
using (
  bucket_id = 'order-attachments'
  and app_private.can_access_order(
    app_private.try_uuid((storage.foldername(name))[1])
  )
);

drop policy if exists "order attachments storage uploaded by active users" on storage.objects;
create policy "order attachments storage uploaded within order scope"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'order-attachments'
  and app_private.current_role() in ('admin', 'manager', 'operator')
  and app_private.can_access_order(
    app_private.try_uuid((storage.foldername(name))[1])
  )
);
