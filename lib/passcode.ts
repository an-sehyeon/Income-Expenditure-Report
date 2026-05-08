import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const APP_PASSCODE_SETTING_KEY = "app_passcode";
export const PASSCODE_STORAGE_KEY = "app-passcode-unlocked-until";
export const PASSCODE_UNLOCK_DURATION_MS = 3 * 60 * 60 * 1000;

const PASSCODE_PATTERN = /^\d{4}$/;

export function isValidPasscodeFormat(value: string): boolean {
  return PASSCODE_PATTERN.test(value);
}

export function normalizePasscodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export async function fetchAppPasscode(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("passcode")
    .eq("key", APP_PASSCODE_SETTING_KEY)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.passcode;
}

export async function verifyAppPasscode(value: string): Promise<boolean> {
  const passcode = await fetchAppPasscode();

  return value === passcode;
}

export async function updateAppPasscode(nextPasscode: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  const { error } = await supabase
    .from("app_settings")
    .update({ passcode: nextPasscode })
    .eq("key", APP_PASSCODE_SETTING_KEY);

  if (error) {
    throw new Error(error.message);
  }
}
