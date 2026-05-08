"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { normalizePasscodeInput, verifyAppPasscode } from "@/lib/passcode";

interface PasscodeLockProps {
  onUnlock: () => void;
}

export function PasscodeLock({ onUnlock }: PasscodeLockProps) {
  const [passcode, setPasscode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);

    try {
      const matched = await verifyAppPasscode(passcode);

      if (matched) {
        setErrorMessage("");
        onUnlock();
        return;
      }

      setErrorMessage("비밀번호가 일치하지 않습니다.");
      setPasscode("");
    } catch {
      setErrorMessage("비밀번호 확인 중 오류가 발생했습니다.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-5">
      <section className="w-full max-w-md rounded-lg border border-app-line bg-white p-6 shadow-soft">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-app-ink text-white">
          <LockKeyhole size={26} />
        </div>
        <div className="mt-5 text-center">
          <h1 className="text-xl font-bold text-app-ink">기선이네 비밀장부</h1>
          <p className="mt-2 text-sm text-app-muted">앱을 사용하려면 4자리 비밀번호를 입력해주세요.</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <input
            autoFocus
            className="w-full rounded-md border border-app-line bg-app-background px-4 py-4 text-center text-3xl font-bold text-app-ink outline-none focus:border-app-accent"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]*"
            placeholder="••••"
            type="password"
            value={passcode}
            onChange={(event) => {
              setErrorMessage("");
              setPasscode(normalizePasscodeInput(event.target.value));
            }}
          />
          {errorMessage ? <p className="text-center text-sm font-semibold text-app-expense">{errorMessage}</p> : null}
          <button
            className="w-full rounded-md bg-app-ink px-4 py-4 font-bold text-white disabled:opacity-50"
            disabled={checking}
            type="submit"
          >
            {checking ? "확인 중..." : "확인"}
          </button>
        </form>
      </section>
    </main>
  );
}
