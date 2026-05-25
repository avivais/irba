"use client";

import { useActionState } from "react";
import {
  promoteWaitlistAction,
  type SessionAttendanceState,
} from "@/app/admin/(protected)/sessions/[id]/actions";

const initialState: SessionAttendanceState = { ok: false };

export function SessionPromoteButton({
  sessionId,
  attendanceId,
  playerName,
  replaceOptions,
}: {
  sessionId: string;
  attendanceId: string;
  playerName: string;
  replaceOptions: { attendanceId: string; playerName: string }[];
}) {
  const action = promoteWaitlistAction.bind(null, sessionId, attendanceId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-1.5">
      <select
        name="replaceAttendanceId"
        required
        disabled={pending}
        defaultValue=""
        aria-label={`בחר מי יוחלף כדי לקדם את ${playerName}`}
        className="min-w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <option value="" disabled>
          במקום…
        </option>
        {replaceOptions.map((option) => (
          <option key={option.attendanceId} value={option.attendanceId}>
            {option.playerName}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:active:bg-zinc-600"
        aria-label={`קדם את ${playerName} לרשימת המשתתפים`}
      >
        קדם
      </button>
      {state.message && !state.ok && (
        <span className="basis-full text-xs text-red-600 dark:text-red-400">
          {state.message}
        </span>
      )}
    </form>
  );
}
