alter table public.order_comments
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles(id) on delete set null;

create policy "comments resolved within order scope"
on public.order_comments for update
to authenticated
using (
  app_private.current_role() in ('admin', 'manager', 'operator')
  and app_private.can_access_order(order_id)
)
with check (
  app_private.current_role() in ('admin', 'manager', 'operator')
  and app_private.can_access_order(order_id)
  and resolved_at is not null
  and resolved_by = app_private.current_profile_id()
);

grant update (resolved_at, resolved_by)
on public.order_comments to authenticated;
