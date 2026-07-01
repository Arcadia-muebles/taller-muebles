revoke all privileges on public.agenda_items from anon;
revoke all privileges on public.agenda_items from authenticated;

grant select, insert on public.agenda_items to authenticated;
grant update (scheduled_date, time_slot, start_time, end_time, title, notes, status)
on public.agenda_items to authenticated;

grant all privileges on public.agenda_items to service_role;
