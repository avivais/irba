"use client";

import { useState } from "react";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry, IneligibleEntry } from "@/lib/challenge-analytics";

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

type Props = {
  number: number;
  isActive: boolean;
  isClosed: boolean;
  startDate: Date | string;
  sessionCount: number;
  effectiveThreshold: number;
  completedSessions: number;
  winnerName?: string | null;
  leaderboard: LeaderboardEntry[];
  ineligible: IneligibleEntry[];
  currentPlayerId: string | null;
};

export function ChallengeCard({
  number,
  isActive,
  isClosed,
  startDate,
  sessionCount,
  effectiveThreshold,
  completedSessions,
  winnerName,
  leaderboard,
  ineligible,
  currentPlayerId,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // Pre-compute which player is the FIRST to appear with each rank
  // (ties: only the first occurrence gets the rank/medal, rest get "–")
  const firstWithRank = new Set<string>();
  const seenRanks = new Set<number>();
  for (const entry of leaderboard) {
    if (!seenRanks.has(entry.rank)) {
      firstWithRank.add(entry.playerId);
      seenRanks.add(entry.rank);
    }
  }

  const top3 = leaderboard.filter((e) => e.rank <= 3).slice(0, 3);
  const rest = leaderboard.slice(top3.length);
  const myEntry = currentPlayerId ? leaderboard.find((e) => e.playerId === currentPlayerId) : null;

  const startDateFormatted = new Date(startDate).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5 pb-3">
        <div className="flex items-start gap-2">
          <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              סיבוב {number}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {sessionCount} מפגשים מ-{startDateFormatted} · סף זכאות {effectiveThreshold} משחקים
            </p>
            {isClosed && winnerName && (
              <p className="mt-0.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                🏆 זוכה: {winnerName} — כניסה חינם
              </p>
            )}
            {isActive && (
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                {completedSessions} מתוך {sessionCount} מפגשים הסתיימו
              </p>
            )}
          </div>
        </div>
        {isActive && !isClosed ? (
          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            פעיל
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            סגור
          </span>
        )}
      </div>

      {/* Empty state */}
      {leaderboard.length === 0 && ineligible.length === 0 && (
        <p className="px-5 pb-5 text-sm text-zinc-400 dark:text-zinc-500">
          אין נתונים להצגה עדיין.
        </p>
      )}

      {/* Podium — top 3 */}
      {top3.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
          {top3.map((entry) => {
            const isMe = currentPlayerId === entry.playerId;
            const isWinner = isClosed && entry.rank === 1;
            const isFirst = firstWithRank.has(entry.playerId);
            const medal = isFirst
              ? (RANK_MEDALS[entry.rank] ?? `${entry.rank}.`)
              : "–";
            return (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 px-5 py-3 ${
                  isMe ? "bg-blue-50 dark:bg-blue-950/20" : ""
                }`}
              >
                <span className={`shrink-0 ${isFirst ? "text-xl" : "w-6 text-center text-sm text-zinc-400 dark:text-zinc-500"}`}>
                  {medal}
                </span>
                <span
                  className={`flex-1 text-sm font-medium ${
                    isMe
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {entry.displayName}
                  {isMe && (
                    <span className="mr-1.5 text-xs font-normal text-blue-500 dark:text-blue-400">
                      (אתה)
                    </span>
                  )}
                  {isWinner && (
                    <span className="mr-1.5 text-xs font-normal text-amber-500 dark:text-amber-400">
                      🏆
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span
                    dir="ltr"
                    className={`text-sm tabular-nums font-semibold ${
                      isMe
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {Math.round(entry.winRatio * 100)}%
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
                    {entry.matchesPlayed} משחקים
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My position (if not in top 3 and list is collapsed) */}
      {myEntry && myEntry.rank > 3 && !expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-blue-50 dark:bg-blue-950/20 flex items-center gap-3 px-5 py-3">
          <span className="w-6 shrink-0 text-center text-sm font-medium text-blue-600 dark:text-blue-400 tabular-nums">
            {firstWithRank.has(myEntry.playerId) ? myEntry.rank : "–"}
          </span>
          <span className="flex-1 text-sm font-medium text-blue-700 dark:text-blue-300">
            {myEntry.displayName}
            <span className="mr-1.5 text-xs font-normal text-blue-500 dark:text-blue-400">
              (אתה)
            </span>
          </span>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span dir="ltr" className="text-sm tabular-nums font-semibold text-blue-700 dark:text-blue-300">
              {Math.round(myEntry.winRatio * 100)}%
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
              {myEntry.matchesPlayed} משחקים
            </span>
          </div>
        </div>
      )}

      {/* Expand / collapse remaining eligible */}
      {rest.length > 0 && (
        <>
          <div className="border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 px-5 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" aria-hidden />
                  הצג פחות
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" aria-hidden />
                  הצג הכל ({leaderboard.length} שחקנים)
                </>
              )}
            </button>
          </div>

          {expanded && (
            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
              {rest.map((entry) => {
                const isMe = currentPlayerId === entry.playerId;
                const isFirst = firstWithRank.has(entry.playerId);
                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center gap-3 px-5 py-3 ${
                      isMe ? "bg-blue-50 dark:bg-blue-950/20" : ""
                    }`}
                  >
                    <span
                      className={`w-6 shrink-0 text-center text-sm tabular-nums ${
                        isMe
                          ? "font-bold text-blue-600 dark:text-blue-400"
                          : "font-medium text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {isFirst ? entry.rank : "–"}
                    </span>
                    <span
                      className={`flex-1 text-sm font-medium ${
                        isMe
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {entry.displayName}
                      {isMe && (
                        <span className="mr-1.5 text-xs font-normal text-blue-500 dark:text-blue-400">
                          (אתה)
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span
                        dir="ltr"
                        className={`text-sm tabular-nums ${
                          isMe
                            ? "font-bold text-blue-700 dark:text-blue-300"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {Math.round(entry.winRatio * 100)}%
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {entry.matchesPlayed} משחקים
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Ineligible players — not yet reached threshold */}
      {ineligible.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <p className="px-5 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            לא עומדים בסף עדיין
          </p>
          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {ineligible.map((entry) => {
              const isMe = currentPlayerId === entry.playerId;
              return (
                <div
                  key={entry.playerId}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    isMe ? "bg-blue-50 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <span className="w-6 shrink-0 text-center text-sm text-zinc-300 dark:text-zinc-600">
                    –
                  </span>
                  <span
                    className={`flex-1 text-sm ${
                      isMe
                        ? "font-medium text-blue-700 dark:text-blue-300"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {entry.displayName}
                    {isMe && (
                      <span className="mr-1.5 text-xs font-normal text-blue-500 dark:text-blue-400">
                        (אתה)
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      dir="ltr"
                      className="text-sm tabular-nums text-zinc-400 dark:text-zinc-500"
                    >
                      {Math.round(entry.winRatio * 100)}%
                    </span>
                    <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                      {entry.matchesPlayed} משחקים · חסרים {entry.gamesNeeded}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-2" />
    </div>
  );
}
