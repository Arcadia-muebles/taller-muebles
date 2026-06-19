alter table public.production_steps
add column if not exists work_sessions jsonb not null default '[]'::jsonb;
