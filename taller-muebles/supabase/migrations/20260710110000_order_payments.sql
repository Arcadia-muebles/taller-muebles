create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  paid_at date not null,
  amount numeric(14, 2) not null check (amount > 0),
  method text not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_payments_order_paid_at_idx on public.order_payments (order_id, paid_at desc, created_at desc);
create index if not exists order_payments_created_by_idx on public.order_payments (created_by);

alter table public.order_payments enable row level security;

create policy "order payments readable by active users"
on public.order_payments for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "order payments managed by admin and managers"
on public.order_payments for insert
to authenticated
with check (app_private.is_admin_or_manager());

grant select, insert on table public.order_payments to authenticated;
grant select, insert, update, delete on table public.order_payments to service_role;

notify pgrst, 'reload schema';
