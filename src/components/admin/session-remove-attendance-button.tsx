"use client";

import { useActionState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import {
  removePlayerAction as removeAttendanceAction,
  type SessionAttendanceState as SessionActionState,
} from "@/app/admin/(protected)/sessions/[id]/actions";

type Props = {
  sessionId: string;
  attendanceId: string;
  playerName: string;
};

const initialState: SessionActionState = { ok: false };

export function SessionRemoveAttendanceButton({ sessionId, attendanceId, playerName }: Props) {
  const boundAction = removeAttendanceAction.bind(null, sessionId, attendanceId);
  const [, formAction, pending] = useActionState(boundAction, initialState);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(`להסיר את ${playerName} מהמפגש?`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        onClick={handleClick}
        title={`הסר את ${playerName}`}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30 dark:active:bg-red-900/50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <UserMinus className="h-3.5 w-3.5" aria-hidden />
        )}
        הסר
      </button>
    </form>
  );
}
