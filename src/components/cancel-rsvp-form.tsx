"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction} className="w-full max-w-md">
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mb-2 rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-green-50 text-green-900"
              : "bg-red-50 text-red-900"
          }`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            מבטל…
          </>
        ) : (
          "ביטול הגעה"
        )}
      </button>
    </form>
  );
}
