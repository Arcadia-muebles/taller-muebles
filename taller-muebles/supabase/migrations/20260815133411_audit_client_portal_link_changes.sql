create or replace function app_private.audit_client_portal_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  previous_value text;
  next_value text;
begin
  if tg_op = 'INSERT' then
    audit_action := 'create_client_portal_link';
    previous_value := null;
    next_value := new.expires_at::text;
  elsif old.revoked_at is null and new.revoked_at is not null then
    audit_action := 'revoke_client_portal_link';
    previous_value := old.expires_at::text;
    next_value := new.revoked_at::text;
  elsif old.expires_at is distinct from new.expires_at then
    audit_action := 'update_client_portal_link';
    previous_value := old.expires_at::text;
    next_value := new.expires_at::text;
  else
    return new;
  end if;

  insert into public.audit_logs (
    order_id,
    profile_id,
    entity,
    entity_id,
    action,
    old_value,
    new_value
  ) values (
    new.order_id,
    app_private.current_profile_id(),
    'client_portal_link',
    new.id,
    audit_action,
    previous_value,
    next_value
  );

  return new;
end;
$$;

revoke all on function app_private.audit_client_portal_link_change()
from public, anon, authenticated;

drop trigger if exists audit_client_portal_link_changes
on public.client_portal_links;

create trigger audit_client_portal_link_changes
after insert or update of expires_at, revoked_at
on public.client_portal_links
for each row
execute function app_private.audit_client_portal_link_change();

comment on function app_private.audit_client_portal_link_change() is
'Writes client portal link lifecycle changes to audit_logs in the same transaction.';
