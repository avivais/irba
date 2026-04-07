"use client";

import { useState } from "react";
import type { PlayerAnalytics } from "@/app/profile/analytics";

type Props = {
  analytics: PlayerAnalytics;
};

function formatDateHe(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  }).format(new Date(date));
}

function WinBar({ wins, losses, ties }: { wins: number; losses: number; ties: number }) {
  const total = wins + losses + ties;
  if (total === 0) return <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>;

  const winPct = Math.round((wins / total) * 100);
  const lossPct = Math.round((losses / total) * 100);
  const tiePct = 100 - winPct - lossPct;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {winPct > 0 && (
          <div className="h-full bg-green-500" style={{ width: `${winPct}%` }} />
        )}
        {tiePct > 0 && (
          <div className="h-full bg-yellow-400" style={{ width: `${tiePct}%` }} />
        )}
        {lossPct > 0 && (
          <div className="h-full bg-red-400" style={{ width: `${lossPct}%` }} />
        )}
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {wins}נ{losses > 0 ? ` ${losses}ה` : ""}{ties > 0 ? ` ${ties}ת` : ""}
      </span>
    </div>
  );
}

type View = "round" | "session";

export function MatchStatsSection({ analytics }: Props) {
  const { stats, sessionBreakdown, roundBreakdown, sessionDates, roundSize, topTeammates } = analytics;
  const [view, setView] = useState<View>("round");

  const sessionRows = [...sessionBreakdown].reverse();
  const roundRows = [...roundBreakdown].reverse();

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">סטטיסטיקות משחק</h2>
      </div>

      {stats.total === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          עדיין לא שיחקת משחקים מתועדים.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {/* Summary row */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.wins}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">ניצחונות</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500 dark:text-red-400">{stats.losses}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">הפסדות</p>
            </div>
            {stats.ties > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{stats.ties}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">תיקו</p>
              </div>
            )}
            <div className="mr-auto text-center">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {Math.round(stats.winRatio * 100)}%
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">אחוז ניצחון</p>
            </div>
          </div>

          {/* Breakdown */}
          {(roundRows.length > 0 || sessionRows.length > 0) && (
            <div>
              {/* Tab toggle — pure client state, no navigation */}
              <div className="flex items-center gap-1 px-5 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => setView("round")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    view === "round"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  לפי סבב
                </button>
                <button
                  type="button"
                  onClick={() => setView("session")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    view === "session"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  לפי מפגש
                </button>
              </div>

              {/* Round breakdown */}
              {view === "round" && (
                <ul className="divide-y divide-zinc-50 px-5 pb-3 dark:divide-zinc-800/60">
                  {roundRows.length === 0 ? (
                    <li className="py-3 text-sm text-zinc-400 dark:text-zinc-500">אין נתוני סבבים.</li>
                  ) : (
                    roundRows.map((row) => (
                      <li key={row.round} className="flex items-center justify-between py-2.5">
                        <div>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">
                            סבב {row.round}
                          </span>
                          <span className="mr-2 text-xs text-zinc-400 dark:text-zinc-500">
                            {formatDateHe(row.startDate)}
                            {row.startDate.getTime() !== row.endDate.getTime()
                              ? ` — ${formatDateHe(row.endDate)}`
                              : ""}
                          </span>
                        </div>
                        <WinBar wins={row.wins} losses={row.losses} ties={row.ties} />
                      </li>
                    ))
                  )}
                  <li className="pt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    {roundSize} מפגשים לסבב
                  </li>
                </ul>
              )}

              {/* Session breakdown */}
              {view === "session" && (
                <ul className="divide-y divide-zinc-50 px-5 pb-3 dark:divide-zinc-800/60">
                  {sessionRows.length === 0 ? (
                    <li className="py-3 text-sm text-zinc-400 dark:text-zinc-500">אין נתוני מפגשים.</li>
                  ) : (
                    sessionRows.map((row) => {
                      const d = sessionDates[row.sessionId] ?? row.date;
                      return (
                        <li key={row.sessionId} className="flex items-center justify-between py-2.5">
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">
                            {formatDateHe(d)}
                          </span>
                          <WinBar wins={row.wins} losses={row.losses} ties={row.ties} />
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Teammate affinity */}
          {topTeammates.length > 0 && (
            <div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  שותפי ניצחון מובילים
                </p>
              </div>
              <ul className="divide-y divide-zinc-50 px-5 pb-3 dark:divide-zinc-800/60">
                {topTeammates.map((t, i) => (
                  <li key={t.teammateId} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">{t.displayName}</span>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t.sharedWins} ניצחונות מתוך {t.totalMatchesTogether} משחקים יחד
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
