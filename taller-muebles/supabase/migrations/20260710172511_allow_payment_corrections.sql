drop policy if exists "order payments updated by admin and managers" on public.order_payments;
create policy "order payments updated by admin and managers"
on public.order_payments for update
to authenticated
using (app_private.is_admin_or_manager())
with check (app_private.is_admin_or_manager());

drop policy if exists "order payments deleted by admin and managers" on public.order_payments;
create policy "order payments deleted by admin and managers"
on public.order_payments for delete
to authenticated
using (app_private.is_admin_or_manager());

grant update, delete on table public.order_payments to authenticated;

notify pgrst, 'reload schema';
