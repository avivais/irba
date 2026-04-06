"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  rsvpAuthenticatedAction,
  type RsvpActionState,
} from "@/app/actions/rsvp";

const initialState: RsvpActionState = { ok: false };

export function AuthenticatedRsvpForm({ playerName }: { playerName: string }) {
  const [state, formAction, pending] = useActionState(
    rsvpAuthenticatedAction,
    initialState,
  );
  const [dismissedState, setDismissedState] = useState<RsvpActionState | null>(
    null,
  );

  useEffect(() => {
    if (!state.ok || !state.message) return;
    const t = setTimeout(() => setDismissedState(state), 3000);
    return () => clearTimeout(t);
  }, [state]);

  const serverError =
    !pending && !state.ok && state.message ? state.message : null;
  const showSuccess = state.ok && state.message && state !== dismissedState;

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-md flex-col items-center gap-4"
    >
      <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
        {playerName}
      </p>

      {serverError && (
        <p
          role="alert"
          className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {serverError}
        </p>
      )}

      {showSuccess && (
        <p
          role="status"
          className="w-full rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-green-500/40"
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
