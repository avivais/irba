"use client";

import { useActionState, useEffect, useState } from "react";
import {
  cancelAttendanceAction,
  type RsvpActionState,
} from "@/app/actions/rsvp";
import { Loader2 } from "lucide-react";

const initialState: RsvpActionState = { ok: false };

export function CancelRsvpForm() {
  const [state, formAction, pending] = useActionState(
    cancelAttendanceAction,
    initialState,
  );
  const [confirming, setConfirming] = useState(false);
  const [dismissedState, setDismissedState] = useState<RsvpActionState | null>(null);

  // Reset confirming when the action resolves
  useEffect(() => {
    if (!state.message) return;
    const t = setTimeout(() => setConfirming(false), 0);
    return () => clearTimeout(t);
  }, [state]);

  // Auto-dismiss success message after 3s by capturing the dismissed state reference
  useEffect(() => {
    if (!state.ok || !state.message) return;
    const t = setTimeout(() => setDismissedState(state), 3000);
    return () => clearTimeout(t);
  }, [state]);

  const showMessage = !!state.message && state !== dismissedState;

  return (
    <form action={formAction} className="mx-auto w-full max-w-md">
      {showMessage && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mb-3 rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-100"
              : "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100"
          }`}
        >
          {state.message}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
            האם לבטל את ההגעה?
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  מבטל…
                </>
              ) : (
                "כן, בטל"
              )}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              לא
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600 dark:focus:ring-red-500"
        >
          ביטול הגעה
        </button>
      )}
    </form>
  );
}
