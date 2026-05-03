alter table public.admin_products
add column if not exists variant_groups jsonb not null default '[]'::jsonb;

