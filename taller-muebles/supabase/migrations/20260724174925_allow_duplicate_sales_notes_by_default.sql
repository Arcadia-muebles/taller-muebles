update public.system_settings
set
  value = jsonb_set(
    value,
    '{orders}',
    coalesce(value -> 'orders', '{}'::jsonb)
      || '{"enforceUniqueSalesNote": false}'::jsonb,
    true
  ),
  updated_at = now()
where id = true;
