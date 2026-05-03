"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, History, X } from "lucide-react";
import {
  applyRetroCloseDebtAction,
  previewRetroCloseDebtAction,
  type RetroPreview,
} from "@/app/admin/(protected)/players/[id]/retro/actions";

const TYPE_LABEL: Record<string, string> = {
  REGISTERED: "קבוע",
  DROP_IN: "מזדמן",
  ADMIN_OVERRIDE: "עקיפה",
  FREE_ENTRY: "כניסה חינם",
};

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  }).format(new Date(d));
}

function formatSigned(n: number): string {
  if (n === 0) return "₪0";
  return n > 0 ? `+₪${n}` : `-₪${Math.abs(n)}`;
}

export function PlayerRetroButton({
  playerId,
  streakCount,
}: {
  playerId: string;
  streakCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<RetroPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [applying, startApplying] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const router = useRouter();

  function openModal() {
    setError(null);
    setPreview(null);
    setOpen(true);
    startLoading(async () => {
      const res = await previewRetroCloseDebtAction(playerId);
      if (res.ok) setPreview(res.preview);
      else setError(res.message);
    });
  }

  function closeModal() {
    setOpen(false);
    setPreview(null);
    setError(null);
    setExpanded(new Set());
  }

  function toggleSession(sessionId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function handleApply() {
    if (!preview || preview.affectedSessions.length === 0) return;
    startApplying(async () => {
      const res = await applyRetroCloseDebtAction(playerId);
      if (res.ok) {
        closeModal();
        router.refresh();
      } else {
        setError(res.message ?? "שגיאה");
      }
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              סגירת חוב רטרואקטיבית
            </h3>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              חישוב מחדש של {streakCount} המפגשים האחרונים שחויבו כמזדמן (חוב), כאילו שולמו כקבוע. שאר השחקנים באותם מפגשים יחויבו מחדש בהתאם.
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            תצוגה מקדימה
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                סגירת חוב רטרואקטיבית
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="סגור"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">טוען תצוגה מקדימה…</p>
              )}
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
                  {error}
                </p>
              )}
              {preview && !loading && (
                <>
                  {preview.affectedSessions.length === 0 && preview.skippedSessions.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      אין שינויים לבצע — לשחקן אין רצף חיובי מזדמן בסוף ההיסטוריה.
                    </p>
                  ) : (
                    <>
                      {/* Per-session diff */}
                      {preview.affectedSessions.length > 0 && (
                        <ul className="mb-4 flex flex-col gap-2">
                          {preview.affectedSessions.map((session) => {
                            const isExpanded = expanded.has(session.sessionId);
                            const focal = session.changes.find((c) => c.isFocalPlayer);
                            const others = session.changes.filter((c) => !c.isFocalPlayer);
                            return (
                              <li
                                key={session.sessionId}
                                className="rounded-lg border border-zinc-200 dark:border-zinc-700"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSession(session.sessionId)}
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-right hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                  <span className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-zinc-500" aria-hidden />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-zinc-500" aria-hidden />
                                    )}
                                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                      {formatDate(session.sessionDate)}
                                    </span>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      ({session.changes.length} שינויים)
                                    </span>
                                  </span>
                                  {focal && (
                                    <span
                                      dir="ltr"
                                      className="tabular-nums text-xs font-medium text-zinc-700 dark:text-zinc-300"
                                    >
                                      ₪{focal.oldAmount} → ₪{focal.newAmount}
                                      <span
                                        className={`ms-2 ${
                                          focal.newAmount - focal.oldAmount < 0
                                            ? "text-green-700 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                        }`}
                                      >
                                        ({formatSigned(focal.newAmount - focal.oldAmount)})
                                      </span>
                                    </span>
                                  )}
                                </button>

                                {isExpanded && (
                                  <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
                                    {focal && (
                                      <div className="mb-2 flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1.5 text-xs dark:bg-amber-950/20">
                                        <span className="font-medium text-amber-900 dark:text-amber-200">
                                          {focal.playerName}{" "}
                                          <span className="text-amber-700 dark:text-amber-400">
                                            ({TYPE_LABEL[focal.oldChargeType] ?? focal.oldChargeType} → {TYPE_LABEL[focal.newChargeType] ?? focal.newChargeType})
                                          </span>
                                        </span>
                                        <span dir="ltr" className="tabular-nums text-amber-900 dark:text-amber-200">
                                          ₪{focal.oldAmount} → ₪{focal.newAmount}{" "}
                                          <span className="font-semibold">
                                            ({formatSigned(focal.newAmount - focal.oldAmount)})
                                          </span>
                                        </span>
                                      </div>
                                    )}
                                    {others.length > 0 && (
                                      <ul className="flex flex-col gap-1 text-xs">
                                        {others.map((ch) => (
                                          <li
                                            key={ch.chargeId}
                                            className="flex items-center justify-between gap-2 text-zinc-700 dark:text-zinc-300"
                                          >
                                            <span>{ch.playerName}</span>
                                            <span dir="ltr" className="tabular-nums">
                                              ₪{ch.oldAmount} → ₪{ch.newAmount}{" "}
                                              <span
                                                className={
                                                  ch.newAmount - ch.oldAmount < 0
                                                    ? "text-green-700 dark:text-green-400"
                                                    : "text-red-600 dark:text-red-400"
                                                }
                                              >
                                                ({formatSigned(ch.newAmount - ch.oldAmount)})
                                              </span>
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {preview.skippedSessions.length > 0 && (
                        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                          <p className="mb-1 font-medium">דולגו ({preview.skippedSessions.length}):</p>
                          <ul className="flex flex-wrap gap-x-3 gap-y-1">
                            {preview.skippedSessions.map((s) => (
                              <li key={s.sessionId}>
                                {formatDate(s.sessionDate)} (חיוב עם עקיפת מנהל)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Totals */}
                      <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          <span className="text-zinc-600 dark:text-zinc-400">החזר לשחקן:</span>
                          <span
                            dir="ltr"
                            className={`tabular-nums text-left font-medium ${
                              preview.totals.focalDiff < 0
                                ? "text-green-700 dark:text-green-400"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {formatSigned(-preview.totals.focalDiff)}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">תוספת לשאר השחקנים:</span>
                          <span
                            dir="ltr"
                            className={`tabular-nums text-left font-medium ${
                              preview.totals.othersDiff > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {formatSigned(preview.totals.othersDiff)}
                          </span>
                          {preview.totals.residual !== 0 && (
                            <>
                              <span className="text-zinc-500 dark:text-zinc-500">שארית עיגול:</span>
                              <span dir="ltr" className="tabular-nums text-left text-zinc-500">
                                {formatSigned(preview.totals.residual)}
                              </span>
                            </>
                          )}
                          <span className="border-t border-zinc-100 pt-1.5 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                            יתרה נוכחית:
                          </span>
                          <span
                            dir="ltr"
                            className="tabular-nums border-t border-zinc-100 pt-1.5 text-left text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                          >
                            ₪{preview.currentBalance}
                          </span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            יתרה אחרי החלת השינויים:
                          </span>
                          <span
                            dir="ltr"
                            className={`tabular-nums text-left font-semibold ${
                              preview.projectedBalance < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-700 dark:text-green-400"
                            }`}
                          >
                            ₪{preview.projectedBalance}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-700">
              <button
                type="button"
                onClick={closeModal}
                disabled={applying}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={
                  applying ||
                  loading ||
                  !preview ||
                  preview.affectedSessions.length === 0
                }
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                {applying ? "מחיל…" : "החל שינויים"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
