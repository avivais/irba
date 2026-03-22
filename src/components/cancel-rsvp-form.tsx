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
    <form action={formAction} className="mx-auto w-full max-w-md">
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mb-2 rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-100"
              : "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100"
          }`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!window.confirm("האם לבטל את ההגעה?")) e.preventDefault();
        }}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600 dark:focus:ring-red-500"
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
