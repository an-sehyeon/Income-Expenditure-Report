# 수익지출관리

Next.js 14, Supabase, Tailwind CSS로 만든 개인용 모바일 수익/지출 관리 웹앱입니다. Spring Boot 서버나 Next.js API Route 없이 브라우저에서 Supabase JS 클라이언트로 Supabase PostgreSQL에 직접 저장합니다.

한 사람이 개인적으로 쓰는 가벼운 앱을 목표로 만들었고, Vercel 무료 플랜과 Supabase 무료 플랜으로 배포할 수 있습니다. 로그인 기능은 포함하지 않았습니다.

## 사용 기술

- Next.js 14
- App Router
- TypeScript
- Supabase PostgreSQL
- `@supabase/supabase-js`
- Tailwind CSS
- Vercel 배포
- PWA 기본 설정: `app/manifest.ts`, 모바일 홈 화면 추가 지원

## 주요 기능

- 수익/지출 등록
- 수익/지출 목록 조회
- 거래 내역 수정 모달
- 삭제 전 `window.confirm` 확인
- 월별, 연도별, 전체 통계
- 월별/연도별/전체 필터
- 수익만/지출만/전체 필터
- 모바일 앱처럼 보이는 `max-w-md` 레이아웃과 하단 탭 메뉴

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
│  └─ schema.sql
├─ types/
│  └─ index.ts
├─ .env.example
├─ package.json
└─ README.md
```

## Supabase 프로젝트 생성 방법

1. [Supabase](https://supabase.com/)에 가입합니다.
2. 새 프로젝트를 만듭니다.
3. 프로젝트 생성 후 왼쪽 메뉴에서 **SQL Editor**를 엽니다.
4. 아래 SQL 전체를 붙여넣고 실행합니다.
5. 왼쪽 메뉴에서 **Project Settings > API**로 이동합니다.
6. `Project URL`과 `anon public` key를 복사합니다.
7. 이 값을 `.env.local` 또는 Vercel 환경변수에 넣습니다.

## Supabase 테이블, Trigger, RLS, 개인용 정책 SQL

아래 SQL은 `transactions` 테이블 생성, `updated_at` 자동 갱신 trigger, RLS 활성화, anon role CRUD 정책을 모두 포함합니다.

```sql
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
```

같은 내용은 `supabase/schema.sql` 파일에도 들어 있습니다.

## 로그인 없이 개인용으로 사용할 때의 보안 주의사항

이 앱은 로그인 기능 없이 Supabase `anon` key로 직접 데이터베이스에 접근합니다. README의 SQL은 개인용 데모를 위해 `anon` role이 `transactions` 테이블에 대해 `SELECT`, `INSERT`, `UPDATE`, `DELETE`를 할 수 있게 허용합니다.

중요합니다. 앱 주소, Supabase URL, Supabase anon key가 외부에 노출되면 다른 사람이 데이터를 읽거나 추가하거나 수정하거나 삭제할 수 있습니다. 그래서 이 구조는 공개 서비스, 여러 사용자가 쓰는 서비스, 민감한 개인정보를 저장하는 서비스에 적합하지 않습니다.

실제 운영용으로 확장하거나 여러 사용자가 쓰게 만들려면 Supabase Auth를 추가하고, `transactions` 테이블에 `user_id` 컬럼을 둔 뒤 본인 데이터만 접근하도록 RLS 정책을 바꿔야 합니다.

## 환경변수 설정 방법

루트 폴더에 `.env.local` 파일을 만들고 아래처럼 입력합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

실제 키는 코드에 직접 넣지 마세요. `.env.local`은 Git에 포함되지 않도록 `.gitignore`에 등록되어 있습니다.

## 로컬 실행 방법

Node.js 18.17 이상을 권장합니다.

```bash
npm install
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```bash
http://localhost:3000
```

배포 전 빌드 확인은 아래 명령어로 합니다.

```bash
npm run build
```

ESLint 확인은 아래 명령어로 합니다.

```bash
npm run lint
```

## Vercel 배포 방법

1. 이 프로젝트를 GitHub 저장소에 올립니다.
2. [Vercel](https://vercel.com/)에 로그인합니다.
3. **Add New > Project**를 누릅니다.
4. GitHub 저장소를 선택합니다.
5. Framework Preset이 `Next.js`인지 확인합니다.
6. **Environment Variables**에 아래 두 값을 추가합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
7. **Deploy**를 누릅니다.
8. 배포가 끝나면 Vercel URL로 접속해서 거래 등록과 목록 조회가 되는지 확인합니다.

환경변수를 나중에 바꿨다면 Vercel에서 다시 배포해야 변경 내용이 반영됩니다.

## 핸드폰 홈 화면에 추가하는 방법

### iOS Safari

1. iPhone에서 Safari로 배포된 앱 주소를 엽니다.
2. 하단 공유 버튼을 누릅니다.
3. **홈 화면에 추가**를 선택합니다.
4. 이름이 `수익지출관리`인지 확인하고 추가합니다.
5. 홈 화면 아이콘을 누르면 브라우저 탭보다 앱에 가까운 화면으로 열립니다.

### Android Chrome

1. Android에서 Chrome으로 배포된 앱 주소를 엽니다.
2. 오른쪽 위 메뉴를 누릅니다.
3. **홈 화면에 추가** 또는 **앱 설치**를 선택합니다.
4. 이름을 확인하고 추가합니다.
5. 홈 화면 아이콘으로 실행합니다.

이 프로젝트는 기본 manifest만 포함합니다. 복잡한 Service Worker나 오프라인 캐싱은 구현하지 않았으므로 인터넷 연결이 필요합니다.

## 무료 플랜 사용 시 주의할 점

- Supabase 무료 플랜은 프로젝트가 장기간 사용되지 않으면 일시 중지될 수 있습니다.
- 무료 플랜에는 데이터베이스 용량, API 요청량, Edge 기능 사용량 제한이 있습니다.
- Vercel 무료 플랜도 빌드 시간, 대역폭, 함수 사용량 제한이 있습니다.
- 이 앱은 Next.js API Route를 쓰지 않으므로 서버리스 함수 사용량은 거의 없지만, Supabase API 요청은 사용량에 포함됩니다.
- 개인 금융 데이터가 들어갈 수 있으므로 URL과 키 노출에 주의하세요.

## 초보자를 위한 사용 흐름

1. Supabase 프로젝트를 만들고 SQL을 실행합니다.
2. `.env.local`에 Supabase URL과 anon key를 넣습니다.
3. `npm install`을 실행합니다.
4. `npm run dev`로 로컬에서 테스트합니다.
5. `npm run build`로 빌드가 되는지 확인합니다.
6. GitHub에 올리고 Vercel에 연결합니다.
7. Vercel 환경변수를 설정하고 배포합니다.
8. 핸드폰 브라우저에서 열고 홈 화면에 추가합니다.
