"use client";

import { useState } from "react";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry, IneligibleEntry, SessionStat } from "@/lib/challenge-analytics";

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

type SessionInfo = { id: string; date: Date | string };

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
  sessions: SessionInfo[];
};

function WinLossBar({ wins, losses, className = "" }: { wins: number; losses: number; className?: string }) {
  const decided = wins + losses;
  const winPct = decided === 0 ? 50 : (wins / decided) * 100;
  return (
    <div className={`flex h-1.5 overflow-hidden rounded-full ${className}`} dir="ltr">
      <div className="bg-green-500 transition-all" style={{ width: `${winPct}%` }} />
      <div className="bg-red-400 opacity-70 transition-all" style={{ width: `${100 - winPct}%` }} />
    </div>
  );
}

function SessionBreakdown({
  sessionStats,
  sessions,
}: {
  sessionStats: SessionStat[];
  sessions: SessionInfo[];
}) {
  const dateMap = new Map(sessions.map((s) => [s.id, new Date(s.date)]));
  const activeStats = sessionStats.filter((s) => s.total > 0);
  if (activeStats.length === 0) return null;

  return (
    <div className="border-t border-zinc-100 px-5 py-3 space-y-2 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
      {activeStats.map((stat) => {
        const date = dateMap.get(stat.sessionId);
        const label = date
          ? date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })
          : "?";
        const decided = stat.wins + stat.losses;
        const pct = decided === 0 ? 0 : Math.round((stat.wins / decided) * 100);
        return (
          <div key={stat.sessionId} className="flex items-center gap-2">
            <span className="shrink-0 w-10 text-xs text-zinc-400 tabular-nums">{label}</span>
            <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
              {stat.wins}נ׳ {stat.losses}ה׳
            </span>
            <WinLossBar wins={stat.wins} losses={stat.losses} className="flex-1 min-w-0" />
            <span className="shrink-0 w-8 text-right text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-400" dir="ltr">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlayerRow({
  entry,
  medal,
  isMe,
  isWinner,
  sessions,
  dimmed,
}: {
  entry: (LeaderboardEntry | IneligibleEntry);
  medal: string;
  isMe: boolean;
  isWinner: boolean;
  sessions: SessionInfo[];
  dimmed?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = entry.matchesPlayed > 0;
  const decided = entry.wins + entry.losses;
  const winPct = decided === 0 ? 0 : Math.round((entry.wins / decided) * 100);
  const isMedal = medal.length > 2; // emoji medals are multi-char

  return (
    <div className={isMe ? "bg-blue-50 dark:bg-blue-950/20" : ""}>
      <div
        role={canExpand ? "button" : undefined}
        onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
        className={`flex items-center gap-3 px-5 py-3 ${canExpand ? "cursor-pointer select-none active:bg-zinc-50 dark:active:bg-zinc-800/40" : ""} ${dimmed ? "opacity-50" : ""}`}
      >
        {/* Medal / rank */}
        <span className={`shrink-0 ${isMedal ? "text-xl w-6 text-center" : "w-6 text-center text-sm text-zinc-400 dark:text-zinc-500"}`}>
          {medal}
        </span>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${isMe ? "text-blue-700 dark:text-blue-300" : dimmed ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}>
            {entry.displayName}
          </span>
          {isMe && (
            <span className="mr-1 text-xs font-normal text-blue-500 dark:text-blue-400"> (אתה)</span>
          )}
          {isWinner && (
            <span className="mr-1 text-xs"> 🏆</span>
          )}
        </div>

        {/* Stats */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
              {entry.wins}נ׳ {entry.losses}ה׳
            </span>
            <WinLossBar wins={entry.wins} losses={entry.losses} className="w-14" />
            <span
              className={`text-sm font-semibold tabular-nums w-9 text-left ${isMe ? "text-blue-700 dark:text-blue-300" : dimmed ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300"}`}
              dir="ltr"
            >
              {winPct}%
            </span>
          </div>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
            {entry.matchesPlayed} משחקים
            {"gamesNeeded" in entry && entry.gamesNeeded > 0 && (
              <> · חסרים {entry.gamesNeeded}</>
            )}
          </span>
        </div>

        {/* Expand chevron */}
        {canExpand && (
          <span className="shrink-0 text-zinc-300 dark:text-zinc-600">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>

      {/* Per-session breakdown */}
      {expanded && canExpand && (
        <SessionBreakdown sessionStats={entry.sessionStats} sessions={sessions} />
      )}
    </div>
  );
}

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
  sessions,
}: Props) {
  const [listExpanded, setListExpanded] = useState(false);
  const [ineligibleExpanded, setIneligibleExpanded] = useState(false);

  // Pre-compute which player is the FIRST to appear with each rank
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
            const medal = isFirst ? (RANK_MEDALS[entry.rank] ?? `${entry.rank}.`) : "–";
            return (
              <PlayerRow
                key={entry.playerId}
                entry={entry}
                medal={medal}
                isMe={isMe}
                isWinner={isWinner}
                sessions={sessions}
              />
            );
          })}
        </div>
      )}

      {/* My position (if not in top 3 and list is collapsed) */}
      {myEntry && myEntry.rank > 3 && !listExpanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <PlayerRow
            entry={myEntry}
            medal={firstWithRank.has(myEntry.playerId) ? String(myEntry.rank) : "–"}
            isMe
            isWinner={false}
            sessions={sessions}
          />
        </div>
      )}

      {/* Expand / collapse remaining eligible */}
      {rest.length > 0 && (
        <>
          <div className="border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setListExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 px-5 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              {listExpanded ? (
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

          {listExpanded && (
            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
              {rest.map((entry) => {
                const isMe = currentPlayerId === entry.playerId;
                const isFirst = firstWithRank.has(entry.playerId);
                return (
                  <PlayerRow
                    key={entry.playerId}
                    entry={entry}
                    medal={isFirst ? String(entry.rank) : "–"}
                    isMe={isMe}
                    isWinner={false}
                    sessions={sessions}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Ineligible players — collapsed by default */}
      {ineligible.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setIneligibleExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-5 py-3 text-right hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              לא עומדים בסף עדיין
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
                {ineligible.length} שחקנים
              </span>
              {ineligibleExpanded
                ? <ChevronUp className="h-4 w-4 text-zinc-400" aria-hidden />
                : <ChevronDown className="h-4 w-4 text-zinc-400" aria-hidden />}
            </div>
          </button>

          {ineligibleExpanded && (
            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
              {ineligible.map((entry) => {
                const isMe = currentPlayerId === entry.playerId;
                return (
                  <PlayerRow
                    key={entry.playerId}
                    entry={entry}
                    medal="–"
                    isMe={isMe}
                    isWinner={false}
                    sessions={sessions}
                    dimmed={!isMe}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="h-2" />
    </div>
  );
}
