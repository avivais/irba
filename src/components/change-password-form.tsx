"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { changePasswordAction, type PlayerAuthState } from "@/app/actions/player-auth";

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<PlayerAuthState, FormData>(
    changePasswordAction,
    { ok: false },
  );

  if (state.ok) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {hasPassword && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="currentPassword"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            סיסמה נוכחית
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className={`${inputBase} ${inputNormal}`}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="newPassword"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          סיסמה חדשה
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={`${inputBase} ${inputNormal}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          אימות סיסמה
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={`${inputBase} ${inputNormal}`}
        />
      </div>

      {state.message && !state.ok && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {hasPassword ? "שנה סיסמה" : "הגדר סיסמה"}
      </button>
    </form>
  );
}
