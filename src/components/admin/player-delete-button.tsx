"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  deletePlayerAction,
  type PlayerActionState,
} from "@/app/admin/(protected)/players/actions";

type Props = {
  id: string;
  playerName: string;
  attendanceCount: number;
};

const initialState: PlayerActionState = { ok: false };

export function PlayerDeleteButton({ id, playerName, attendanceCount }: Props) {
  const boundAction = deletePlayerAction.bind(null, id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const canDelete = attendanceCount === 0;
  const title = canDelete
    ? `מחק את ${playerName}`
    : `לא ניתן למחוק — יש ל${playerName} ${attendanceCount} נוכחויות`;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!canDelete) {
      e.preventDefault();
      return;
    }
    const confirmed = window.confirm(
      `האם למחוק את ${playerName}? פעולה זו אינה ניתנת לביטול.`,
    );
    if (!confirmed) {
      e.preventDefault();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={!canDelete || pending}
          title={title}
          onClick={handleClick}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 border-red-200 text-red-600 hover:bg-red-50 focus:ring-red-300 disabled:border-zinc-200 disabled:text-zinc-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 dark:focus:ring-red-700 dark:disabled:border-zinc-700 dark:disabled:text-zinc-600"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
          מחק
        </button>
      </form>
      {!state.ok && state.message && (
        <p
          role="alert"
          className="max-w-[16rem] text-xs text-red-600 dark:text-red-400"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
