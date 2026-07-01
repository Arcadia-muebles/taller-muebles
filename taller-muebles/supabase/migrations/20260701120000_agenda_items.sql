create type public.agenda_item_kind as enum ('delivery', 'task');
create type public.agenda_item_status as enum ('pending', 'done', 'cancelled');
create type public.agenda_time_slot as enum ('AM', 'PM');

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  kind public.agenda_item_kind not null,
  order_id uuid references public.orders(id) on delete cascade,
  title text not null,
  notes text,
  scheduled_date date not null,
  time_slot public.agenda_time_slot not null,
  start_time time not null,
  end_time time not null,
  status public.agenda_item_status not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_delivery_requires_order check (kind <> 'delivery' or order_id is not null),
  constraint agenda_task_without_order check (kind <> 'task' or order_id is null)
);

create unique index agenda_one_pending_delivery_per_order_idx
on public.agenda_items (order_id)
where kind = 'delivery' and status = 'pending';

create index agenda_items_scheduled_date_idx
on public.agenda_items (scheduled_date, time_slot, start_time);

create index agenda_items_status_idx
on public.agenda_items (status);

create trigger agenda_items_touch_updated_at
before update on public.agenda_items
for each row execute function app_private.touch_updated_at();

alter table public.agenda_items enable row level security;

create policy "agenda items readable within role scope"
on public.agenda_items for select
to authenticated
using (app_private.current_profile_id() is not null);

create policy "agenda items inserted by admins and managers"
on public.agenda_items for insert
to authenticated
with check (
  app_private.is_admin_or_manager()
  and created_by = app_private.current_profile_id()
);

create policy "agenda items updated by admins and managers"
on public.agenda_items for update
to authenticated
using (app_private.is_admin_or_manager())
with check (app_private.is_admin_or_manager());

grant select, insert on public.agenda_items to authenticated;
grant update (scheduled_date, time_slot, start_time, end_time, title, notes, status)
on public.agenda_items to authenticated;
grant all privileges on public.agenda_items to service_role;
