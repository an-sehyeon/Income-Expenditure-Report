create table if not exists public.app_settings (
  key text primary key,
  passcode text not null check (passcode ~ '^[0-9]{4}$'),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, passcode)
values ('app_passcode', '6262')
on conflict (key) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_settings_updated_at on public.app_settings;

create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

alter table public.app_settings enable row level security;

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

-- 비밀번호를 잊어버렸을 때 6262로 초기화하려면 아래 SQL을 실행하세요.
-- update public.app_settings
-- set passcode = '6262',
--     updated_at = now()
-- where key = 'app_passcode';
