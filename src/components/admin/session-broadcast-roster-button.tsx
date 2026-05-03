"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import {
  broadcastSessionRosterAction,
  type SessionAttendanceState,
} from "@/app/admin/(protected)/sessions/[id]/actions";

const initialState: SessionAttendanceState = { ok: false };

export function SessionBroadcastRosterButton({ sessionId }: { sessionId: string }) {
  const action = broadcastSessionRosterAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(action, initialState);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("לשלוח עדכון רשימה לקבוצת הוואטסאפ?")) {
      e.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="relative">
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Send className="h-3.5 w-3.5" aria-hidden />
        {pending ? "שולח…" : "שלח עדכון רשימה"}
      </button>
      {state.message && !pending && (
        <span
          role="status"
          className={`absolute end-0 top-full mt-1 whitespace-nowrap rounded px-2 py-1 text-xs ${
            state.ok
              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
          }`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
