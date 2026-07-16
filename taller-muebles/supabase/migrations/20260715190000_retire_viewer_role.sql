-- Client-facing access now uses revocable Portal Cliente links. The legacy
-- viewer role remains in the enum for schema compatibility, but cannot retain
-- an active internal profile.
update public.profiles
set active = false
where role = 'viewer'
  and active = true;
