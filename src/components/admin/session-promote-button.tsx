"use client";

import { useActionState } from "react";
import { promoteWaitlistAction, type SessionAttendanceState } from "@/app/admin/(protected)/sessions/[id]/actions";

const initialState: SessionAttendanceState = { ok: false };

export function SessionPromoteButton({
  sessionId,
  attendanceId,
  playerName,
}: {
  sessionId: string;
  attendanceId: string;
  playerName: string;
}) {
  const action = promoteWaitlistAction.bind(null, sessionId, attendanceId);
  const [, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="rounded px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:active:bg-zinc-600"
        aria-label={`קדם את ${playerName} לרשימת המשתתפים`}
      >
        קדם
      </button>
    </form>
  );
}
