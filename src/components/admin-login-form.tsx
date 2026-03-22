"use client";

import { useActionState } from "react";
import {
  adminLoginAction,
  type AdminLoginState,
} from "@/app/admin/actions";
import { Loader2 } from "lucide-react";

const initialState: AdminLoginState = { ok: false };

const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(
    adminLoginAction,
    initialState,
  );

  const serverError =
    !pending && !state.ok && state.message ? state.message : null;

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="admin-password"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          סיסמה
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={512}
          aria-invalid={Boolean(serverError)}
          aria-describedby={serverError ? "admin-login-error" : undefined}
          className={`rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${serverError ? inputInvalid : inputNormal}`}
        />
      </div>

      {serverError && (
        <p
          id="admin-login-error"
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-zinc-300/50"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            בודק…
          </>
        ) : (
          "כניסה"
        )}
      </button>
    </form>
  );
}
