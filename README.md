# 수익지출관리

농산물을 경매로 판매한 뒤, 품목별 매출과 농사 지출을 기록하고 월별/연도별 순이익과 이익률을 확인하는 개인용 모바일 웹앱입니다.

로그인 없이 한 사람이 개인적으로 사용하는 것을 전제로 만들었습니다. Next.js API Route나 별도 서버 없이 브라우저에서 Supabase JS 클라이언트로 Supabase PostgreSQL에 직접 저장합니다.

## 사용 기술

- Next.js 14
- App Router
- TypeScript
- Supabase PostgreSQL
- `@supabase/supabase-js`
- Tailwind CSS
- Recharts
- Vercel 배포
- PWA 기본 설정

## 주요 기능

- 품목명, 박스 개수, 경매 단가 입력
- `박스 개수 x 경매 단가`로 총매출 자동 계산
- 농사 지출 카테고리와 금액 입력
- 월별/연도별/전체 총매출, 총지출, 순이익, 이익률 계산
- 선택 월 매출/지출 비중 차트
- 선택 연도 매출/지출 비중 차트
- 월별 지출 카테고리 차트
- 품목별 월 매출 차트
- 거래 수정/삭제
- 모바일 하단 탭 UI
- 핸드폰 홈 화면에 추가 가능한 PWA manifest

## 폴더 구조

```txt
.
├─ app/
│  ├─ globals.css
│  ├─ layout.tsx
│  ├─ manifest.ts
│  └─ page.tsx
├─ lib/
│  ├─ supabase.ts
│  └─ utils.ts
├─ public/
│  └─ icons/
│     ├─ icon-192x192.png
│     └─ icon-512x512.png
├─ supabase/
│  ├─ migration_add_auction_columns.sql
│  └─ schema.sql
├─ types/
│  └─ index.ts
├─ .env.example
├─ package.json
└─ README.md
```

## DB 변경 사항

기존 `transactions` 테이블에 농산물 경매 수익 입력을 위한 컬럼 3개가 추가됩니다.

- `item_name`: 농산물 품목명
- `box_count`: 박스 개수
- `auction_price`: 박스 1개당 경매 단가

기존 `amount` 컬럼은 계속 사용합니다. 수익 거래에서는 앱 코드가 `box_count * auction_price`를 계산해서 `amount`에 총매출액으로 저장합니다. 지출 거래에서는 사용자가 입력한 지출 금액을 `amount`에 저장합니다.

기존 배포 후 DB 구조를 수정해야 하는 이유는 앱이 이제 수익 거래를 단순 금액 입력이 아니라 품목명, 박스 개수, 경매 단가 기반으로 저장하기 때문입니다. 기존 데이터를 유지해야 하므로 테이블을 삭제하지 않고 `ALTER TABLE ADD COLUMN IF NOT EXISTS` 방식으로 컬럼만 추가합니다.

## 기존 프로젝트 업데이트용 Migration SQL

Supabase Dashboard → SQL Editor → New query → 아래 SQL 붙여넣기 → Run 순서로 실행하세요.

```sql
alter table public.transactions
add column if not exists item_name text;

alter table public.transactions
add column if not exists box_count integer;

alter table public.transactions
add column if not exists auction_price numeric(15, 2);
```

### Migration 실행 순서

1. Supabase Dashboard에 접속합니다.
2. 프로젝트를 선택합니다.
3. 왼쪽 메뉴에서 SQL Editor를 엽니다.
4. New query를 누릅니다.
5. 위 Migration SQL을 붙여넣습니다.
6. Run을 누릅니다.
7. Table Editor에서 `transactions` 테이블에 새 컬럼 3개가 생겼는지 확인합니다.

### 기존 데이터가 있을 때 주의할 점

- 기존 거래 내역은 삭제되지 않습니다.
- 기존 수익 데이터에는 `item_name`, `box_count`, `auction_price`가 `null`로 남을 수 있습니다.
- 새 앱에서 새로 입력하는 수익부터 품목명, 박스 개수, 경매 단가가 저장됩니다.
- 기존 수익 데이터를 품목별 차트에 포함하려면 Supabase Table Editor에서 직접 값을 채워 넣어야 합니다.

### Migration 후 확인 쿼리

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transactions'
  and column_name in ('item_name', 'box_count', 'auction_price')
order by column_name;
```

앱에서 수익을 하나 입력한 뒤 아래 쿼리로 `amount = box_count * auction_price`로 저장되는지 확인할 수 있습니다.

```sql
select
  transaction_date,
  item_name,
  box_count,
  auction_price,
  amount
from public.transactions
where type = 'income'
order by created_at desc
limit 5;
```

## 새 프로젝트에서 처음 실행할 전체 SQL

처음 Supabase 프로젝트를 만드는 경우 아래 SQL 전체를 실행하세요. 테이블 생성, `updated_at` 자동 갱신 trigger, RLS 활성화, 개인용 anon CRUD 정책을 모두 포함합니다.

```sql
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
```

같은 내용은 `supabase/schema.sql`에도 들어 있습니다.

## 기존 프로젝트에서 정책 확인 SQL

Migration은 컬럼만 추가합니다. 기존 RLS 정책이 잘 남아 있는지 확인하려면 아래 쿼리를 실행하세요.

```sql
select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'transactions'
order by policyname;
```

## Migration 후 재배포가 필요한 이유

코드가 새 컬럼인 `item_name`, `box_count`, `auction_price`를 읽고 저장합니다. Supabase DB에 컬럼을 추가한 뒤 Vercel에 새 코드를 재배포해야 배포된 앱이 새 입력 화면과 차트를 사용할 수 있습니다.

문제가 생길 가능성에 대비해 Migration 전 Supabase Table Editor에서 CSV export를 하거나, SQL Editor에서 기존 데이터를 백업해두는 것을 권장합니다. 이번 Migration은 컬럼 추가만 하므로 되돌릴 때도 기존 거래 데이터는 그대로 남습니다. 다만 컬럼 삭제는 실수 위험이 있으니 운영 중에는 먼저 백업하세요.

## 이번 수정의 DB Migration 안내

이번 수정은 목록의 일자별 조회, 통계 월 선택 반영, 집계 기준 통일, 차트 범례 개선 작업입니다. 기존 `transactions` 테이블 구조를 그대로 사용하므로 추가 DB migration은 필요하지 않습니다.

## Supabase 데이터 전체 조회 방식

Supabase/PostgREST는 한 번의 `select("*")` 호출에서 반환되는 행 수에 제한이 있을 수 있습니다. 더미데이터나 실제 사용 데이터가 1,000건을 초과하면 일부 데이터만 앱으로 들어와 월별/연도별 통계가 SQL Editor 결과와 다르게 보일 수 있습니다.

이 앱은 `transactions` 데이터를 `range()`로 페이지 단위 조회합니다.

- 페이지 크기: 1,000건
- 조회 범위 예시: `0~999`, `1000~1999`, `2000~2999`
- 마지막 페이지의 데이터 개수가 1,000건보다 작으면 전체 조회가 끝난 것으로 판단합니다.
- 목록, 통계, 차트, 연도 선택은 이렇게 합쳐진 전체 `transactions` 배열을 기준으로 계산합니다.

`range()` 페이지네이션을 사용할 때는 정렬 기준이 안정적이어야 합니다. `transaction_date`만 정렬하면 같은 날짜 데이터가 많은 경우 페이지 경계에서 순서가 흔들려 중복/누락이 생길 수 있습니다. 현재 앱은 아래 순서로 정렬합니다.

```ts
.order("transaction_date", { ascending: false })
.order("created_at", { ascending: false })
.order("id", { ascending: false })
```

또한 페이지 결과를 합친 뒤 `id` 기준 `Map`으로 한 번 더 중복을 제거합니다. 앱 결과와 Supabase SQL 결과가 다르면 개발용 디버그 패널에서 `duplicateTransactionCount`와 `duplicateTransactionIds`를 확인하세요.

이번 페이지 단위 조회 수정은 앱 코드 변경만 포함합니다. DB 구조 변경 없음, Supabase 추가 SQL 실행 불필요.

## 앱 결과 검증용 SQL

앱에서 선택한 연도, 월, 일자와 SQL의 날짜 조건을 반드시 맞춰서 비교하세요. 앱은 `transaction_date` 문자열의 `YYYY-MM`, `YYYY`, `YYYY-MM-DD` 부분을 기준으로 필터링합니다. SQL 결과와 앱 화면 결과가 다르면 날짜 필터 또는 숫자 변환 로직을 먼저 확인하세요.

### 선택 월 요약 검증 SQL

선택 월 요약과 비교할 때는 반드시 특정 월 하나만 조회하는 SQL을 사용하세요. 예를 들어 앱에서 `2025년 1월`을 선택했다면 SQL도 `2025-01-01` 이상, `2025-02-01` 미만 조건을 사용해야 합니다. 월별 전체 목록이나 다른 월이 섞인 결과와 비교하면 앱 화면과 값이 다르게 보일 수 있습니다.

앱의 `선택 월 요약`, `선택 월 매출/지출 비중 차트`, 아래 Supabase 특정 월 SQL 결과는 모두 같은 값이어야 합니다.

```sql
select
  coalesce(sum(amount) filter (where type = 'income'), 0) as total_income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
  coalesce(sum(amount) filter (where type = 'income'), 0)
    - coalesce(sum(amount) filter (where type = 'expense'), 0) as net_profit,
  case
    when coalesce(sum(amount) filter (where type = 'income'), 0) = 0
      then 0
    else round(
      (
        (
          coalesce(sum(amount) filter (where type = 'income'), 0)
          - coalesce(sum(amount) filter (where type = 'expense'), 0)
        )
        / coalesce(sum(amount) filter (where type = 'income'), 0)
      ) * 100,
      1
    )
  end as profit_rate
from public.transactions
where transaction_date >= date '2025-01-01'
  and transaction_date < date '2025-02-01';
```

### 선택 연도 요약 검증 SQL

예시는 `2026`년 기준입니다.

```sql
with summary as (
  select
    coalesce(sum(case when type = 'income' then amount else 0 end), 0) as total_income,
    coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as total_expense
  from public.transactions
  where to_char(transaction_date, 'YYYY') = '2026'
)
select
  total_income,
  total_expense,
  total_income - total_expense as net_profit,
  case
    when total_income = 0 then 0
    else round(((total_income - total_expense) / total_income * 100)::numeric, 1)
  end as profit_rate
from summary;
```

### 품목별 월 매출 검증 SQL

```sql
select
  item_name,
  sum(amount) as total_income
from public.transactions
where type = 'income'
  and item_name is not null
  and item_name <> ''
  and to_char(transaction_date, 'YYYY-MM') = '2026-05'
group by item_name
order by total_income desc;
```

### 지출 카테고리별 월 지출 검증 SQL

```sql
select
  category,
  sum(amount) as total_expense
from public.transactions
where type = 'expense'
  and to_char(transaction_date, 'YYYY-MM') = '2026-05'
group by category
order by total_expense desc;
```

### 특정 일자 거래 검증 SQL

예시는 `2026-05-12` 기준입니다. 전체 거래는 type 조건을 빼고, 수익만 보려면 `type = 'income'`, 지출만 보려면 `type = 'expense'`를 사용하세요.

```sql
select
  transaction_date,
  type,
  item_name,
  category,
  box_count,
  auction_price,
  amount,
  memo
from public.transactions
where transaction_date = date '2026-05-12'
order by created_at desc;
```

## Supabase 결과와 앱 결과가 다를 때 확인할 항목

특정 월 통계가 다르게 보이면 먼저 Supabase SQL과 앱 개발 환경 디버그 패널의 거래 건수와 금액 합계를 비교하세요. 앱의 선택 월 요약, 선택 월 차트, 지출 카테고리 차트는 모두 선택 월 거래 배열인 `selectedMonthTransactions` 기준이어야 합니다.

이번 디버그 보강은 앱 코드 변경만 포함합니다. DB 구조 변경 없음, Supabase 추가 SQL 실행 불필요.

### 특정 월 전체 거래 수 확인 SQL

예시는 `2026년 1월` 기준입니다.

```sql
select
  count(*) as total_count
from public.transactions
where transaction_date >= date '2026-01-01'
  and transaction_date < date '2026-02-01';
```

### 특정 월 수익/지출 거래 수 확인 SQL

```sql
select
  count(*) as total_count,
  count(*) filter (where type = 'income') as income_count,
  count(*) filter (where type = 'expense') as expense_count,
  coalesce(sum(amount) filter (where type = 'income'), 0) as income_total,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as expense_total
from public.transactions
where transaction_date >= date '2026-01-01'
  and transaction_date < date '2026-02-01';
```

### 앱 개발 환경 디버그 패널 확인

`npm run dev`로 실행한 개발 환경에서 통계 화면을 열면 `개발용 선택 월 디버그` 패널이 표시됩니다. 아래 값이 Supabase SQL 결과와 같은지 확인하세요.

- `selectedMonthTransactions.length`
- `selectedMonthIncomeCount`
- `selectedMonthExpenseCount`
- `selectedMonthIncomeTotalByAmount`
- `selectedMonthExpenseTotalByAmount`
- `selectedMonthIncomeTotalByBoxAuction`
- `selectedMonthIncomeTotalDiff`
- `duplicateTransactionCount`
- `duplicateTransactionIds`

디버그 패널에는 선택 월 income 거래 각각의 `amount` 원본 값, `safeNumber(amount)` 결과, `box_count * auction_price` 계산값, 두 값의 차이도 표로 표시됩니다. 앱 값과 SQL 값이 다르면 수익/지출 집계가 전체 `transactions`가 아니라 선택 월 기준 배열인 `selectedMonthTransactions`에서 계산되고 있는지, 그리고 숫자 문자열 변환이 올바른지 먼저 확인해야 합니다.

## 홈 화면 월 요약

홈 화면은 앱에 접속한 날짜 기준의 해당 월 요약을 보여줍니다. 예를 들어 9월 28일에 접속하면 `9월 순이익`, `9월 총매출`, `9월 총지출`, `9월 이익률`처럼 실제 월 숫자를 표시합니다.

## 환경변수

루트 폴더에 `.env.local` 파일을 만들고 아래 값을 넣습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Vercel Dashboard → Project → Settings → Environment Variables에도 같은 이름으로 등록해야 합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

실제 키는 코드에 직접 넣지 마세요. `.env.local`은 `.gitignore`에 포함되어 있습니다.

## 로컬 실행 방법

Node.js 18.17 이상을 권장합니다.

```bash
npm install
npm run dev
npm run build
```

개발 서버는 보통 아래 주소에서 열립니다.

```bash
http://localhost:3000
```

## Vercel 재배포 방법

GitHub 저장소와 Vercel 프로젝트가 이미 연결되어 있다면 보통 `git push`만으로 자동 배포됩니다.

```bash
git add .
git commit -m "농산물 경매 수익 관리 기능 추가"
git push
```

그 다음 Vercel Dashboard에서 자동 배포가 성공했는지 확인합니다. 환경변수를 새로 추가하거나 수정했다면 Vercel에서 Redeploy를 실행하세요.

## 핸드폰 홈 화면에 추가하는 방법

### iOS Safari

1. Safari에서 배포된 앱 주소를 엽니다.
2. 공유 버튼을 누릅니다.
3. 홈 화면에 추가를 선택합니다.
4. 이름을 확인하고 추가합니다.

### Android Chrome

1. Chrome에서 배포된 앱 주소를 엽니다.
2. 오른쪽 위 메뉴를 누릅니다.
3. 홈 화면에 추가 또는 앱 설치를 선택합니다.
4. 이름을 확인하고 추가합니다.

## 설정 메뉴

하단 탭에는 `홈`, `입력`, `목록`, `통계`, `설정` 메뉴가 있습니다. `설정` 화면에서는 앱 잠금 비밀번호 수정, CSV/JSON 파일 백업 다운로드, 로컬 MySQL 자동 백업 안내를 확인할 수 있습니다.

## 비밀번호 잠금 기능

앱에 접속하면 바로 수익지출관리 화면이 열리지 않고, 먼저 4자리 비밀번호 입력 화면이 표시됩니다. 이 기능은 회원가입이나 로그인 기능이 아니며, Supabase Auth도 사용하지 않습니다. 개인용 앱을 가볍게 잠그는 프론트엔드 잠금 기능입니다.

- 기본 비밀번호: `6262`
- 입력 방식: 숫자 4자리
- 인증 유지 기간: 3시간
- 비밀번호 저장 위치: Supabase `public.app_settings`
- 인증 만료 시간 저장 key: `app-passcode-unlocked-until`

예전 방식은 변경한 비밀번호를 브라우저 `localStorage`에 저장했습니다. 이 방식은 브라우저마다 비밀번호가 따로 저장되어, PC에서 바꾼 비밀번호가 핸드폰에는 적용되지 않고 다른 기기에서는 기본 비밀번호 `6262`가 계속 사용될 수 있었습니다.

현재 방식은 비밀번호를 Supabase DB의 `app_settings` 테이블에서 공통으로 관리합니다. 앱은 `key = 'app_passcode'` 행의 `passcode` 값과 사용자가 입력한 4자리 비밀번호를 비교합니다. 설정 화면에서 비밀번호를 변경하면 Supabase DB에 반영되므로 다른 브라우저와 핸드폰에서도 새 비밀번호가 적용됩니다.

비밀번호가 맞으면 브라우저 `localStorage`에는 비밀번호 값이 아니라 인증 만료 시간만 저장됩니다. 만료 시간이 현재 시간보다 미래이면 새로고침하거나 앱을 다시 열어도 바로 앱 화면으로 들어갑니다. 3시간이 지나면 다시 비밀번호 입력 화면이 표시됩니다.

앱 화면 상단의 `로그아웃` 버튼을 누르면 현재 브라우저에 저장된 인증 만료 시간이 삭제되고 다시 비밀번호 입력 화면으로 돌아갑니다. 서버 계정을 로그아웃하는 기능은 아니며, 이 브라우저의 인증 상태를 해제하는 버튼입니다.

비밀번호를 DB에서 바꿔도 이미 인증된 다른 브라우저나 다른 기기는 인증 만료 전까지 최대 3시간 동안 앱 화면에 접근할 수 있습니다. 즉시 다시 비밀번호를 입력하게 만들고 싶으면 해당 기기에서 `로그아웃` 버튼을 누르거나 브라우저 `localStorage`의 `app-passcode-unlocked-until` 값을 삭제하세요.

### Supabase 비밀번호 테이블 migration

기존 프로젝트에 적용할 때는 Supabase Dashboard에서 SQL Editor를 열고 [supabase/migration_add_app_passcode_settings.sql](./supabase/migration_add_app_passcode_settings.sql)을 실행합니다.

```sql
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
```

적용 순서:

1. Supabase Dashboard에 접속합니다.
2. SQL Editor를 엽니다.
3. 위 migration SQL을 실행합니다.
4. 앱을 다시 배포합니다.
5. 기본 비밀번호 `6262`로 접속합니다.
6. 설정 탭에서 새 비밀번호로 변경합니다.
7. 다른 브라우저나 핸드폰에서 새 비밀번호로 접속되는지 확인합니다.

### 설정 화면에서 비밀번호 변경하기

1. 하단 탭에서 `설정`을 누릅니다.
2. `앱 잠금 설정` 섹션에서 현재 비밀번호를 입력합니다.
3. 새 비밀번호 4자리를 입력합니다.
4. 새 비밀번호 확인에 같은 값을 입력합니다.
5. `비밀번호 변경` 버튼을 누릅니다.

현재 비밀번호는 Supabase DB의 `app_settings.passcode` 값과 비교합니다. 새 비밀번호는 숫자 4자리여야 하며, 변경에 성공하면 DB 값이 바뀌고 입력값은 초기화됩니다. 변경 성공 후 현재 브라우저의 인증 상태는 즉시 삭제되며, `비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.` 안내가 표시된 뒤 비밀번호 입력 화면으로 돌아갑니다. 이후에는 새 비밀번호를 입력해야 앱에 다시 들어갈 수 있습니다.

### 비밀번호를 잊어버렸을 때 초기화

Supabase SQL Editor에서 아래 SQL을 실행하면 비밀번호를 다시 `6262`로 초기화할 수 있습니다.

```sql
update public.app_settings
set passcode = '6262',
    updated_at = now()
where key = 'app_passcode';
```

### 잠금 기능 보안 주의사항

이 잠금 기능은 진짜 회원 인증이 아니라 개인용 공통 비밀번호 잠금 기능입니다. 이번 요구사항에서는 비밀번호를 해시하지 않고 Supabase DB에 평문 4자리 문자열로 저장합니다.

`app_settings` 테이블은 로그인 없이 프론트엔드에서 읽고 수정해야 하므로 `anon` role에 select/update 정책이 필요합니다. 따라서 개발자 도구나 Supabase API 사용 방법을 아는 사람은 우회할 가능성이 있습니다. 또한 `transactions` 테이블도 개인용 anon CRUD 정책으로 열려 있다면 UI 잠금만으로 완전한 보안이 되지 않습니다.

실제 보안이 필요하면 Supabase Auth를 추가하고, 서버 검증 또는 `user_id` 기반 RLS 정책으로 본인 데이터만 접근할 수 있게 구조를 바꿔야 합니다.

## CSV/JSON 백업 다운로드

설정 화면의 `데이터 백업` 섹션에서 현재 Supabase에서 가져온 전체 거래 데이터를 파일로 저장할 수 있습니다.

- CSV 다운로드 파일명 예시: `transactions_backup_2026-05-01.csv`
- JSON 다운로드 파일명 예시: `transactions_backup_2026-05-01.json`
- CSV는 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 포함합니다.
- CSV 값에 쉼표, 줄바꿈, 따옴표가 있어도 깨지지 않도록 escaping을 처리합니다.
- JSON은 전체 `transactions` 배열을 2칸 들여쓰기로 저장합니다.

백업 데이터가 없으면 `백업할 데이터가 없습니다.` 안내가 표시됩니다.

## 로컬 MySQL 자동 백업

브라우저 앱은 로컬 MySQL에 직접 연결하지 않습니다. 브라우저에서 로컬 DB에 직접 연결하면 보안상 위험하고, 배포된 Vercel 앱에서도 사용자의 로컬 PC DB에 접근할 수 없습니다.

대신 로컬 PC에서 Node.js 스크립트를 실행해 Supabase 운영 DB의 `transactions` 데이터를 로컬 MySQL 백업 DB로 복사합니다.

- Supabase: 실제 앱이 사용하는 운영 DB
- MySQL: 로컬 PC에 저장하는 백업 DB
- 실행 방식: `npm run backup:mysql`
- 자동화 방식: Windows 작업 스케줄러
- 삭제 정책: Supabase에서 삭제된 데이터도 MySQL 백업 DB에서는 삭제하지 않습니다.

### MySQL 백업 테이블 생성

1. DBeaver를 실행합니다.
2. 로컬 MySQL에 연결합니다.
3. [scripts/create-backup-table.sql](./scripts/create-backup-table.sql) 파일을 엽니다.
4. SQL을 실행합니다.
5. `backup_transactions` 테이블이 생성되었는지 확인합니다.

### `.env.backup` 만들기

1. [.env.backup.example](./.env.backup.example) 파일을 복사합니다.
2. 프로젝트 루트에 `.env.backup` 파일을 만듭니다.
3. Supabase URL/key와 MySQL 접속 정보를 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=
```

`.env.backup`에는 Supabase key와 MySQL 비밀번호가 들어가므로 GitHub에 올리면 안 됩니다. 이 프로젝트의 `.gitignore`에는 `.env.backup`이 포함되어 있습니다.

### 수동 백업 실행

```bash
npm install
npm run backup:mysql
```

실행이 끝나면 DBeaver에서 아래 SQL로 백업 결과를 확인합니다.

```sql
select count(*) from backup_transactions;
select * from backup_transactions order by transaction_date desc, created_at desc, id desc limit 20;
```

백업 스크립트는 Supabase 데이터를 `transaction_date desc`, `created_at desc`, `id desc` 기준으로 페이지 단위 조회합니다. 같은 날짜 데이터가 많아도 range 페이지 경계에서 중복/누락이 생기지 않도록 안정적인 정렬 기준과 id 중복 제거를 함께 사용합니다.

### Windows 작업 스케줄러로 매일 밤 10시 자동 백업

1. Windows 검색에서 `작업 스케줄러`를 실행합니다.
2. 오른쪽에서 `기본 작업 만들기`를 선택합니다.
3. 이름을 `농산물 수익지출관리 MySQL 백업`처럼 입력합니다.
4. 트리거는 `매일`을 선택합니다.
5. 시작 시간은 `오후 10:00`으로 설정합니다.
6. 작업은 `프로그램 시작`을 선택합니다.
7. `프로그램/스크립트`에는 `npm.cmd`를 입력합니다.
   - PowerShell 실행 정책 문제가 있으면 `where npm.cmd`로 전체 경로를 확인해 넣어도 됩니다.
8. `인수 추가`에는 `run backup:mysql`을 입력합니다.
9. `시작 위치`에는 프로젝트 폴더 경로를 입력합니다.
   - 예: `C:\Users\MASTER\Documents\New project`
10. 저장 후 작업을 마우스 오른쪽 버튼으로 눌러 `실행`해 테스트합니다.

자동 백업 주의사항:

- PC가 꺼져 있으면 실행되지 않습니다.
- MySQL 서버가 실행 중이어야 합니다.
- 인터넷 연결이 필요합니다.
- Supabase key와 MySQL 비밀번호가 들어간 `.env.backup` 파일 관리에 주의하세요.
- 이 백업은 실시간 동기화가 아니라 예약 백업입니다.
- Supabase에서 삭제된 거래는 MySQL 백업 DB에서 자동 삭제하지 않습니다.

설정/백업 기능 중 CSV/JSON 다운로드와 MySQL 백업은 Supabase `transactions` 구조를 바꾸지 않습니다. 다만 공통 비밀번호 관리를 위해 Supabase에 `app_settings` 테이블을 추가해야 합니다. 로컬 MySQL 백업을 사용하려면 `backup_transactions` 테이블도 로컬 MySQL에 생성해야 합니다.

## 개인용 사용 시 보안 주의사항

이 앱은 로그인 없이 Supabase `anon` key로 직접 데이터베이스에 접근합니다. README의 정책 SQL은 개인용 데모를 위해 `anon` role이 `transactions` 테이블에 대해 `SELECT`, `INSERT`, `UPDATE`, `DELETE`를 할 수 있게 허용합니다.

중요합니다. 앱 주소, Supabase URL, Supabase anon key가 외부에 노출되면 다른 사람이 데이터를 읽거나 추가하거나 수정하거나 삭제할 수 있습니다. 공개 서비스나 여러 사용자가 쓰는 서비스로 사용하면 안 됩니다.

실제 서비스로 확장하려면 Supabase Auth를 추가하고, `transactions` 테이블에 `user_id` 컬럼을 추가한 뒤 본인 데이터만 접근하도록 RLS 정책을 변경해야 합니다.

## 무료 플랜 주의사항

- Supabase 무료 플랜은 프로젝트가 오래 사용되지 않으면 일시 중지될 수 있습니다.
- Supabase와 Vercel 무료 플랜에는 저장 용량, 요청량, 빌드 시간 제한이 있습니다.
- 개인 금융/농업 매출 데이터가 들어갈 수 있으므로 URL과 key 노출에 주의하세요.
