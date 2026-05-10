"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { sendAdminTestOtpAction, type SendWaActionState } from "@/app/admin/(protected)/wa/actions";

const initialState: SendWaActionState = { ok: false, message: "" };

export function WaAdminOtpForm() {
  const [state, action, pending] = useActionState(sendAdminTestOtpAction, initialState);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      noValidate
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <KeyRound className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">קוד OTP לבדיקה</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            הזן מספר שחקן כדי ליצור עבורו קוד חדש ולקבל אותו בוואטסאפ של האדמין.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="admin-test-otp-phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          מספר טלפון של שחקן
        </label>
        <input
          id="admin-test-otp-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0501234567"
          dir="ltr"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-10 w-full cursor-pointer items-center justify-center rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 active:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-600/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? "שולח…" : "שלח OTP אליי"}
      </button>

      {state.message && (
        <p className={`text-sm ${state.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
