# 농산물 수익지출관리

농부가 하루 수확한 농산물을 경매로 판매한 뒤, 품목별 매출과 농사 지출을 기록하고 월별/연도별 순이익과 이익률을 확인하는 개인용 모바일 웹앱입니다.

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

## 개인용 사용 시 보안 주의사항

이 앱은 로그인 없이 Supabase `anon` key로 직접 데이터베이스에 접근합니다. README의 정책 SQL은 개인용 데모를 위해 `anon` role이 `transactions` 테이블에 대해 `SELECT`, `INSERT`, `UPDATE`, `DELETE`를 할 수 있게 허용합니다.

중요합니다. 앱 주소, Supabase URL, Supabase anon key가 외부에 노출되면 다른 사람이 데이터를 읽거나 추가하거나 수정하거나 삭제할 수 있습니다. 공개 서비스나 여러 사용자가 쓰는 서비스로 사용하면 안 됩니다.

실제 서비스로 확장하려면 Supabase Auth를 추가하고, `transactions` 테이블에 `user_id` 컬럼을 추가한 뒤 본인 데이터만 접근하도록 RLS 정책을 변경해야 합니다.

## 무료 플랜 주의사항

- Supabase 무료 플랜은 프로젝트가 오래 사용되지 않으면 일시 중지될 수 있습니다.
- Supabase와 Vercel 무료 플랜에는 저장 용량, 요청량, 빌드 시간 제한이 있습니다.
- 개인 금융/농업 매출 데이터가 들어갈 수 있으므로 URL과 key 노출에 주의하세요.
