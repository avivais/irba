"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import {
  broadcastDebtorsAction,
  type FinanceActionState,
} from "@/app/admin/(protected)/finance/actions";

const initialState: FinanceActionState = { ok: false };

function formatLastSent(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

export function DebtorsBroadcastButton({
  lastSentAt,
}: {
  lastSentAt: Date | null;
}) {
  const [state, formAction, pending] = useActionState(
    broadcastDebtorsAction,
    initialState,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("לשלוח תזכורת חוב לקבוצת הוואטסאפ?")) {
      e.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800/60 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <Send className="h-3.5 w-3.5" aria-hidden />
        {pending ? "שולח…" : "שלח תזכורת"}
      </button>
      {state.message && !pending ? (
        <span
          role="status"
          className={`text-xs ${
            state.ok
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {state.message}
        </span>
      ) : lastSentAt ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          נשלח לאחרונה: {formatLastSent(lastSentAt)}
        </span>
      ) : (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">לא נשלחה תזכורת עדיין</span>
      )}
    </form>
  );
}
