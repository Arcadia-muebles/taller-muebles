create index if not exists client_portal_links_order_id_idx
on public.client_portal_links(order_id);

create index if not exists client_portal_links_created_by_idx
on public.client_portal_links(created_by)
where created_by is not null;
