"use client";

import { useActionState, useTransition, useState } from "react";
import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
import {
  closePeerRatingSessionAction,
  deletePeerRatingSessionAction,
  recalculateRanksAction,
  type PeerRatingSessionSummary,
  type RankingSessionActionState,
} from "@/app/admin/(protected)/ranking/actions";
import { openPeerRatingSessionAction } from "@/app/admin/(protected)/ranking/actions";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

// ---------------------------------------------------------------------------
// Open new session form
// ---------------------------------------------------------------------------

function OpenSessionForm({ sessions }: { sessions: PeerRatingSessionSummary[] }) {
  const [state, formAction, pending] = useActionState<
    RankingSessionActionState,
    FormData
  >(openPeerRatingSessionAction, { ok: true });

  const currentYear = new Date().getFullYear();
  const isCurrentYearTaken = sessions.some((s) => s.year === currentYear);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="year" value={currentYear} />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          שנה: {currentYear}
        </span>
        <button
          type="submit"
          disabled={pending || isCurrentYearTaken}
          className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`}
        >
          {pending ? "פותח…" : "פתח שאלון חדש"}
        </button>
      </form>
      {isCurrentYearTaken && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          כבר קיים שאלון לשנת {currentYear}
        </p>
      )}
      {!isCurrentYearTaken && !state.ok && state.message && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single session row
// ---------------------------------------------------------------------------

function SessionRow({ session }: { session: PeerRatingSessionSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [closePending, startClose] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function handleClose() {
    startClose(async () => {
      const result = await closePeerRatingSessionAction(session.id);
      if (!result.ok) setToast(result.message ?? "שגיאה");
    });
  }

  function handleDelete() {
    if (!confirm(`למחוק את שאלון ${session.year}? כל ההגשות יימחקו.`)) return;
    startDelete(async () => {
      const result = await deletePeerRatingSessionAction(session.id);
      if (!result.ok) setToast(result.message ?? "שגיאה");
    });
  }

  const isOpen = !session.closedAt;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {session.year}
          </span>
          {isOpen ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
              פתוח
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              סגור
            </span>
          )}
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {session.submitterCount} / {session.totalRegistered} הגשות
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={handleClose}
              disabled={closePending}
              className={`${btnBase} bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400`}
            >
              {closePending ? "סוגר…" : "סגור שאלון"}
            </button>
          )}
          {session.results && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className={`${btnBase} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden />
              )}
              תוצאות
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deletePending}
            aria-label="מחק שאלון"
            className={`${btnBase} text-red-600 hover:bg-red-50 focus:ring-red-400 dark:text-red-400 dark:hover:bg-red-900/20`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {toast && (
        <div className="mx-4 mb-3 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {toast}
          <button onClick={() => setToast(null)} aria-label="סגור">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {expanded && session.results && (
        <div className="border-t border-zinc-100 px-4 pb-4 dark:border-zinc-800">
          <p className="mb-2 mt-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            תוצאות — ממוצע דירוג עמיתים
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800">
                <th className="pb-1 text-right font-medium">#</th>
                <th className="pb-1 pr-3 text-right font-medium">שחקן</th>
                <th className="pb-1 text-right font-medium">ממוצע מיקום</th>
                <th className="pb-1 text-right font-medium">ניקוד</th>
              </tr>
            </thead>
            <tbody>
              {session.results.map((r, i) => (
                <tr
                  key={r.displayName}
                  className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50"
                >
                  <td className="py-1 text-zinc-400">{i + 1}</td>
                  <td className="py-1 pr-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {r.displayName}
                  </td>
                  <td className="py-1 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {r.avgPosition.toFixed(1)}
                  </td>
                  <td className="py-1 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {r.peerScore.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recalculate button
// ---------------------------------------------------------------------------

function RecalculateButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const result = await recalculateRanksAction();
      setMessage(result.message ?? (result.ok ? "עודכן" : "שגיאה"));
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={pending}
        className={`${btnBase} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}
      >
        {pending ? "מחשב…" : "חשב מחדש את כל הדירוגים"}
      </button>
      {message && (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{message}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel export
// ---------------------------------------------------------------------------

export function RankingSessionPanel({
  sessions,
}: {
  sessions: PeerRatingSessionSummary[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <OpenSessionForm sessions={sessions} />

      <RecalculateButton />

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          אין שאלוני דירוג עד כה.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
