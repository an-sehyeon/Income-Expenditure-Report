export function formatAmount(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export function formatDate(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}년 ${month}월 ${day}일`;
}

export function todayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function monthInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatNumberInput(value: string): string {
  const digits = onlyDigits(value);

  if (!digits) {
    return "";
  }

  return Number(digits).toLocaleString("ko-KR");
}

export function parseAmountInput(value: string): number {
  const digits = onlyDigits(value);

  return digits ? Number(digits) : 0;
}
