alter table public.transactions
add column if not exists item_name text;

alter table public.transactions
add column if not exists box_count integer;

alter table public.transactions
add column if not exists auction_price numeric(15, 2);
