create index order_comments_resolved_by_idx
on public.order_comments (resolved_by)
where resolved_by is not null;

create index order_comments_pending_by_order_idx
on public.order_comments (order_id, created_at desc)
where resolved_at is null;
