"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { PlayerAnalytics } from "@/app/profile/analytics";

type Props = {
  analytics: PlayerAnalytics;
  view: "monthly" | "session";
};

function formatMonthHe(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

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

export function MatchStatsSection({ analytics, view }: Props) {
  const { stats, monthlyBreakdown, sessionBreakdown, sessionDates, topTeammates } = analytics;
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildViewUrl(v: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("view", v);
    return `${pathname}?${sp.toString()}`;
  }

  const breakdown =
    view === "monthly"
      ? [...monthlyBreakdown].reverse()
      : [...sessionBreakdown].reverse();

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

          {/* Breakdown with view toggle */}
          {breakdown.length > 0 && (
            <div>
              {/* Tab toggle */}
              <div className="flex items-center gap-1 px-5 pt-4 pb-2">
                <Link
                  href={buildViewUrl("monthly")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    view === "monthly"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  לפי חודש
                </Link>
                <Link
                  href={buildViewUrl("session")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    view === "session"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  לפי מפגש
                </Link>
              </div>

              {/* Breakdown rows */}
              <ul className="divide-y divide-zinc-50 px-5 pb-3 dark:divide-zinc-800/60">
                {breakdown.map((row) => {
                  const label =
                    view === "monthly"
                      ? formatMonthHe((row as typeof monthlyBreakdown[0]).month)
                      : (() => {
                          const sr = row as typeof sessionBreakdown[0];
                          const d = sessionDates[sr.sessionId] ?? sr.date;
                          return formatDateHe(d);
                        })();
                  return (
                    <li key={view === "monthly" ? (row as typeof monthlyBreakdown[0]).month : (row as typeof sessionBreakdown[0]).sessionId} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                      <WinBar wins={row.wins} losses={row.losses} ties={row.ties} />
                    </li>
                  );
                })}
              </ul>
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
                      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 w-4">
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
