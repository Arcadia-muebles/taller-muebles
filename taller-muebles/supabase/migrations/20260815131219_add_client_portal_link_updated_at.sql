alter table public.client_portal_links
add column if not exists updated_at timestamptz;

update public.client_portal_links
set updated_at = coalesce(revoked_at, created_at)
where updated_at is null;

alter table public.client_portal_links
alter column updated_at set default now(),
alter column updated_at set not null;

comment on column public.client_portal_links.updated_at is
'Last server-side change to the link metadata, including expiry edits and revocation.';
