"use client";

import { useActionState } from "react";
import {
  attendAction,
  type RsvpActionState,
} from "@/app/actions/rsvp";
import { Loader2 } from "lucide-react";

const initialState: RsvpActionState = { ok: false };

export function RsvpForm() {
  const [state, formAction, pending] = useActionState(
    attendAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="name"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          שם מלא
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-green-500 dark:focus:ring-green-500/30"
          placeholder="השם שלך"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="phone"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          טלפון נייד ישראלי (מתחיל ב-05)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          className="rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-green-500 dark:focus:ring-green-500/30"
          placeholder="05xxxxxxxx"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ללא קידומת מדינה או + — רק פורמט ישראלי
        </p>
      </div>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
          }
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-600/40 disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-green-500/40"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            שולח…
          </>
        ) : (
          "אני מגיע"
        )}
      </button>
    </form>
  );
}
