"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteRateAction, type RateActionState } from "@/app/admin/(protected)/config/rates/actions";

const initialState: RateActionState = { ok: false };

export function HourlyRateDeleteButton({ id }: { id: string }) {
  const action = deleteRateAction.bind(null, id);
  const [state, formAction, pending] = useActionState(action, initialState);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm("למחוק תעריף זה?")) e.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      {!state.ok && state.message && (
        <p className="mb-1 text-xs text-red-600 dark:text-red-400">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 active:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400/40 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40 dark:active:bg-red-900/50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        מחק
      </button>
    </form>
  );
}
