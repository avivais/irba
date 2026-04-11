"use client";

import { useState } from "react";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/challenge-analytics";
import { METRIC_LABELS } from "@/lib/challenge-validation";
import type { ChallengeMetric } from "@/lib/challenge-analytics";

const PODIUM_MEDALS = ["🥇", "🥈", "🥉"];

function formatValue(value: number, metric: ChallengeMetric): string {
  if (metric === "win_ratio") {
    return `${Math.round(value * 100)}%`;
  }
  return String(value);
}

function formatValueDetail(entry: LeaderboardEntry, metric: ChallengeMetric): string {
  if (metric === "win_ratio") {
    const decided = entry.matchesPlayed - 0; // total includes ties, decided = wins + losses
    return `${Math.round(entry.value * 100)}%`;
  }
  return String(entry.value);
}

type Props = {
  title: string;
  metric: string;
  prize: string | null;
  isActive: boolean;
  windowLabel: string;
  sessionCount: number;
  leaderboard: LeaderboardEntry[];
  currentPlayerId: string | null;
};

export function ChallengeCard({
  title,
  metric,
  prize,
  isActive,
  windowLabel,
  sessionCount,
  leaderboard,
  currentPlayerId,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const cm = metric as ChallengeMetric;

  const top3 = leaderboard.filter((e) => e.rank <= 3).slice(0, 3);
  const rest = leaderboard.slice(top3.length);
  const myEntry = currentPlayerId ? leaderboard.find((e) => e.playerId === currentPlayerId) : null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5 pb-3">
        <div className="flex items-start gap-2">
          <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {METRIC_LABELS[cm]} · {windowLabel}
            </p>
            {prize && (
              <p className="mt-0.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                פרס: {prize}
              </p>
            )}
          </div>
        </div>
        {isActive ? (
          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            פעיל
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            הסתיים
          </span>
        )}
      </div>

      {/* Empty state */}
      {leaderboard.length === 0 && (
        <p className="px-5 pb-5 text-sm text-zinc-400 dark:text-zinc-500">
          אין נתונים להצגה עדיין.
        </p>
      )}

      {/* Podium — top 3 */}
      {top3.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
          {top3.map((entry, i) => {
            const isMe = currentPlayerId === entry.playerId;
            return (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 px-5 py-3 ${
                  isMe ? "bg-blue-50 dark:bg-blue-950/20" : ""
                }`}
              >
                <span className="text-xl shrink-0">{PODIUM_MEDALS[i] ?? `${entry.rank}.`}</span>
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
                <span
                  dir="ltr"
                  className={`shrink-0 text-sm tabular-nums font-semibold ${
                    isMe
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {formatValue(entry.value, cm)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* My position (if not in top 3 and not shown in rest) */}
      {myEntry && myEntry.rank > 3 && !expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-blue-50 dark:bg-blue-950/20 flex items-center gap-3 px-5 py-3">
          <span className="w-6 shrink-0 text-center text-sm font-medium text-blue-600 dark:text-blue-400 tabular-nums">
            {myEntry.rank}
          </span>
          <span className="flex-1 text-sm font-medium text-blue-700 dark:text-blue-300">
            {myEntry.displayName}
            <span className="mr-1.5 text-xs font-normal text-blue-500 dark:text-blue-400">
              (אתה)
            </span>
          </span>
          <span dir="ltr" className="shrink-0 text-sm tabular-nums font-semibold text-blue-700 dark:text-blue-300">
            {formatValue(myEntry.value, cm)}
          </span>
        </div>
      )}

      {/* Expand / collapse remaining */}
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
                      {entry.rank}
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
                    <span
                      dir="ltr"
                      className={`shrink-0 text-sm tabular-nums ${
                        isMe
                          ? "font-bold text-blue-700 dark:text-blue-300"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {formatValue(entry.value, cm)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="h-2" />
    </div>
  );
}
