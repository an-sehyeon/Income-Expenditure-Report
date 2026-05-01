import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// 브라우저에서 Supabase PostgreSQL과 직접 통신하기 위한 클라이언트입니다.
// 환경변수가 없어도 Next.js 빌드는 통과하도록 임시 값을 넣고, 실제 조회 전 화면에서 안내합니다.
export const supabase = createClient<Database>(
  supabaseUrl ?? "https://example.supabase.co",
  supabaseAnonKey ?? "missing-anon-key"
);
