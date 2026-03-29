"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import { removePlayerAction, type SessionAttendanceState } from "@/app/admin/(protected)/sessions/[id]/actions";

const initialState: SessionAttendanceState = { ok: false };

export function SessionRemoveButton({
  sessionId,
  attendanceId,
  playerName,
}: {
  sessionId: string;
  attendanceId: string;
  playerName: string;
}) {
  const action = removePlayerAction.bind(null, sessionId, attendanceId);
  const [, formAction, pending] = useActionState(action, initialState);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(`להסיר את ${playerName} מהמפגש?`)) e.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={pending}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600 active:bg-red-100 disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:active:bg-red-900/50"
        aria-label={`הסר את ${playerName}`}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
