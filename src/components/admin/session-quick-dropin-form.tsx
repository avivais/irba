"use client";

import { useActionState, useRef, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  quickAddDropInAction,
  type SessionAttendanceState,
} from "@/app/admin/(protected)/sessions/[id]/actions";

const initialState: SessionAttendanceState = { ok: false };

export function SessionQuickDropInForm({ sessionId }: { sessionId: string }) {
  const boundAction = quickAddDropInAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        הוסף מזדמן חדש
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          name="name"
          type="text"
          required
          placeholder="שם"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          name="phone"
          type="tel"
          required
          placeholder="05XXXXXXXX"
          dir="ltr"
          className="min-w-0 w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden />
          )}
          הוסף
        </button>
      </div>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-xs ${state.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
