"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { isAppPasscode } from "@/lib/passcode";

interface PasscodeLockProps {
  onUnlock: () => void;
}

export function PasscodeLock({ onUnlock }: PasscodeLockProps) {
  const [passcode, setPasscode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAppPasscode(passcode)) {
      setErrorMessage("");
      onUnlock();
      return;
    }

    setErrorMessage("비밀번호가 일치하지 않습니다.");
    setPasscode("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-5">
      <section className="w-full max-w-md rounded-lg border border-app-line bg-white p-6 shadow-soft">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-app-ink text-white">
          <LockKeyhole size={26} />
        </div>
        <div className="mt-5 text-center">
          <h1 className="text-xl font-bold text-app-ink">기선이네 수익지출관리</h1>
          <p className="mt-2 text-sm text-app-muted">앱을 사용하려면 4자리 비밀번호를 입력해주세요.</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
              setPasscode(event.target.value.replace(/\D/g, "").slice(0, 4));
            }}
          />
          {errorMessage ? <p className="text-center text-sm font-semibold text-app-expense">{errorMessage}</p> : null}
          <button className="w-full rounded-md bg-app-ink px-4 py-4 font-bold text-white" type="submit">
            확인
          </button>
        </form>
      </section>
    </main>
  );
}
