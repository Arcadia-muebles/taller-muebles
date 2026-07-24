drop policy if exists "orders deleted by admins" on public.orders;
create policy "orders deleted by admins"
on public.orders for delete
to authenticated
using (app_private.current_role() = 'admin');

drop policy if exists "order attachments storage deleted by admins" on storage.objects;
create policy "order attachments storage deleted by admins"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'order-attachments'
  and app_private.current_role() = 'admin'
  and app_private.can_access_order(
    app_private.try_uuid((storage.foldername(name))[1])
  )
);
