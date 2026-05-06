export const APP_PASSCODE = "6262";
export const PASSCODE_VALUE_STORAGE_KEY = "app-passcode-value";
export const PASSCODE_STORAGE_KEY = "app-passcode-unlocked-until";
export const PASSCODE_UNLOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PASSCODE_PATTERN = /^\d{4}$/;

// APP_PASSCODE는 반드시 숫자 4자리 문자열이어야 합니다. 예: "6262"
export function isValidPasscodeFormat(value: string): boolean {
  return PASSCODE_PATTERN.test(value);
}

export function normalizePasscodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function getCurrentPasscode(): string {
  if (typeof window === "undefined") {
    return APP_PASSCODE;
  }

  const storedPasscode = window.localStorage.getItem(PASSCODE_VALUE_STORAGE_KEY);

  return storedPasscode && isValidPasscodeFormat(storedPasscode) ? storedPasscode : APP_PASSCODE;
}

export function saveCurrentPasscode(value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PASSCODE_VALUE_STORAGE_KEY, value);
}

export function isAppPasscode(value: string): boolean {
  return value === getCurrentPasscode();
}
