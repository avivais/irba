"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  deleteChallengeAction,
  type ChallengeActionState,
} from "@/app/admin/(protected)/challenges/actions";

type Props = { id: string; number: number };

const initialState: ChallengeActionState = { ok: false };

export function ChallengeDeleteButton({ id, number }: Props) {
  const boundAction = deleteChallengeAction.bind(null, id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const confirmed = window.confirm(`למחוק את סיבוב ${number}? פעולה זו אינה ניתנת לביטול.`);
    if (!confirmed) e.preventDefault();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          onClick={handleClick}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 border-red-200 text-red-600 hover:bg-red-50 focus:ring-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 dark:focus:ring-red-700"
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
        <p role="alert" className="max-w-[16rem] text-xs text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
