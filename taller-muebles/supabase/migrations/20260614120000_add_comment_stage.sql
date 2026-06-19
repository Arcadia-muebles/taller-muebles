alter table public.order_comments
add column if not exists step_key text,
add column if not exists step_label text;
