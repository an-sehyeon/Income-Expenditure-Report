create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(15, 2) not null check (amount >= 0),
  category text not null,
  transaction_date date not null,
  memo text,
  item_name text,
  box_count integer,
  auction_price numeric(15, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
add column if not exists item_name text;

alter table public.transactions
add column if not exists box_count integer;

alter table public.transactions
add column if not exists auction_price numeric(15, 2);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_settings (
  key text primary key,
  passcode text not null check (passcode ~ '^[0-9]{4}$'),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, passcode)
values ('app_passcode', '6262')
on conflict (key) do nothing;

drop trigger if exists set_transactions_updated_at on public.transactions;

create trigger set_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

drop trigger if exists set_app_settings_updated_at on public.app_settings;

create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

alter table public.transactions enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Personal demo anon select transactions" on public.transactions;
drop policy if exists "Personal demo anon insert transactions" on public.transactions;
drop policy if exists "Personal demo anon update transactions" on public.transactions;
drop policy if exists "Personal demo anon delete transactions" on public.transactions;

create policy "Personal demo anon select transactions"
on public.transactions
for select
to anon
using (true);

create policy "Personal demo anon insert transactions"
on public.transactions
for insert
to anon
with check (true);

create policy "Personal demo anon update transactions"
on public.transactions
for update
to anon
using (true)
with check (true);

create policy "Personal demo anon delete transactions"
on public.transactions
for delete
to anon
using (true);

drop policy if exists "Personal demo anon select app passcode" on public.app_settings;
drop policy if exists "Personal demo anon update app passcode" on public.app_settings;

create policy "Personal demo anon select app passcode"
on public.app_settings
for select
to anon
using (key = 'app_passcode');

create policy "Personal demo anon update app passcode"
on public.app_settings
for update
to anon
using (key = 'app_passcode')
with check (key = 'app_passcode' and passcode ~ '^[0-9]{4}$');

grant select, update on public.app_settings to anon;
