"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  toggleChallengeAction,
  type ChallengeActionState,
} from "@/app/admin/(protected)/challenges/actions";

type Props = { id: string; isActive: boolean };

const initialState: ChallengeActionState = { ok: false };

export function ChallengeToggleButton({ id, isActive }: Props) {
  const boundAction = toggleChallengeAction.bind(null, id, !isActive);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 border-zinc-200 text-zinc-600 hover:bg-zinc-50 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:ring-zinc-600"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : isActive ? (
            "סיים"
          ) : (
            "הפעל"
          )}
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
