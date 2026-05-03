export const APP_PASSCODE = "6262";
export const PASSCODE_STORAGE_KEY = "app-passcode-unlocked-until";
export const PASSCODE_UNLOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// APP_PASSCODE는 반드시 숫자 4자리 문자열이어야 합니다. 예: "6262"
export function isAppPasscode(value: string): boolean {
  return value === APP_PASSCODE;
}
