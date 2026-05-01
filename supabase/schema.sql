create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(15, 2) not null check (amount >= 0),
  category text not null,
  transaction_date date not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_transactions_updated_at on public.transactions;

create trigger set_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

alter table public.transactions enable row level security;

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
