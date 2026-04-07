"use client";

import type { PrecedenceRow } from "@/lib/precedence";

type Props = {
  rows: PrecedenceRow[];
  currentPlayerId: string | null;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function LeaderboardTable({ rows, currentPlayerId }: Props) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {rows.map((row, i) => {
        const isMe = currentPlayerId && row.playerId === currentPlayerId;
        const rank = i + 1;
        return (
          <li
            key={row.playerId}
            className={`flex items-center gap-3 px-5 py-3 ${
              isMe
                ? "bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/20 dark:ring-blue-800"
                : ""
            }`}
          >
            {/* Rank */}
            <span className="w-8 shrink-0 text-center">
              {rank <= 3 ? (
                <span aria-label={`מקום ${rank}`}>{MEDALS[rank - 1]}</span>
              ) : (
                <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                  {rank}
                </span>
              )}
            </span>

            {/* Name */}
            <span
              className={`flex-1 text-sm font-medium ${
                isMe
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-zinc-800 dark:text-zinc-200"
              }`}
            >
              {row.playerName}
              {isMe && (
                <span className="mr-1.5 text-xs font-normal text-blue-500 dark:text-blue-400">
                  (אתה)
                </span>
              )}
            </span>

            {/* Score */}
            <span
              dir="ltr"
              className={`shrink-0 text-sm tabular-nums ${
                isMe
                  ? "font-bold text-blue-700 dark:text-blue-300"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {formatScore(row.totalScore)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
