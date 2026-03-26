"use client";

import { useActionState } from "react";
import { Loader2, Lock, LockOpen } from "lucide-react";
import {
  toggleSessionAction,
  type SessionActionState,
} from "@/app/admin/(protected)/sessions/actions";

type Props = {
  id: string;
  isClosed: boolean;
};

const initialState: SessionActionState = { ok: false };

export function SessionToggleButton({ id, isClosed }: Props) {
  const boundAction = toggleSessionAction.bind(null, id);
  const [, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        title={isClosed ? "פתח מפגש להרשמה" : "סגור מפגש להרשמה"}
        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : isClosed ? (
          <LockOpen className="h-4 w-4" aria-hidden />
        ) : (
          <Lock className="h-4 w-4" aria-hidden />
        )}
        {isClosed ? "פתח" : "סגור"}
      </button>
    </form>
  );
}
