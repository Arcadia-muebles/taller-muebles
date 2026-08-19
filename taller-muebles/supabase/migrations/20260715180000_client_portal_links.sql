create table if not exists public.client_portal_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint client_portal_link_dates_valid check (expires_at > created_at)
);

create unique index if not exists client_portal_links_one_active_per_order
on public.client_portal_links(order_id)
where revoked_at is null;

create index if not exists client_portal_links_token_lookup
on public.client_portal_links(token_hash)
where revoked_at is null;

alter table public.client_portal_links enable row level security;

revoke all on public.client_portal_links from anon, authenticated;
grant select, insert, update on public.client_portal_links to authenticated;
grant select, insert, update on public.client_portal_links to service_role;

create policy "client portal links readable by admins"
on public.client_portal_links for select
to authenticated
using (app_private.current_role() = 'admin');

create policy "client portal links created by admins"
on public.client_portal_links for insert
to authenticated
with check (
  app_private.current_role() = 'admin'
  and created_by = app_private.current_profile_id()
);

create policy "client portal links revoked by admins"
on public.client_portal_links for update
to authenticated
using (app_private.current_role() = 'admin')
with check (app_private.current_role() = 'admin');

comment on table public.client_portal_links is
'Revocable, expiring public access tokens for the minimal client order tracking portal. Raw tokens are never stored.';
