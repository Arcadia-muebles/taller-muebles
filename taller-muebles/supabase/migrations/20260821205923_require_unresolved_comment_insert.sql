alter policy "comments inserted within order scope"
on public.order_comments
with check (
  app_private.current_role() in ('admin', 'manager', 'operator')
  and profile_id = app_private.current_profile_id()
  and app_private.can_access_order(order_id)
  and resolved_at is null
  and resolved_by is null
);
