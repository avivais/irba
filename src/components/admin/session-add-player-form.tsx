"use client";

import { useActionState, useRef } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { addPlayerAction, type SessionAttendanceState } from "@/app/admin/(protected)/sessions/[id]/actions";

type Player = { id: string; displayName: string; phone: string };

const initialState: SessionAttendanceState = { ok: false };

export function SessionAddPlayerForm({
  sessionId,
  players,
}: {
  sessionId: string;
  players: Player[];
}) {
  const action = addPlayerAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          ref={selectRef}
          name="playerId"
          defaultValue=""
          aria-label="בחר שחקן להוספה"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30"
        >
          <option value="" disabled>
            בחר שחקן להוספה…
          </option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName} — {p.phone}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || players.length === 0}
          aria-label="הוסף שחקן"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {!state.ok && state.message && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
