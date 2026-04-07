"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PrecedenceRow } from "@/lib/precedence";

type Aggregate = { year: number; count: number };
type Adjustment = { id: string; date: Date; points: number; description: string };

export type PrecedencePlayerDetail = {
  playerId: string;
  aggregates: Aggregate[];
  liveCount: number;
  currentYear: number;
  adjustments: Adjustment[];
};

type Props = {
  rows: PrecedenceRow[];
  details: Record<string, PrecedencePlayerDetail>;
  yearWeights: Record<number, number>;
  currentPlayerId: string | null;
};

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function PlayerDetail({
  detail,
  yearWeights,
}: {
  detail: PrecedencePlayerDetail;
  yearWeights: Record<number, number>;
}) {
  // Build year rows: historical aggregates + current year live count
  const yearRows: { year: number; count: number; weight: number; points: number }[] = [];

  for (const agg of detail.aggregates) {
    if (agg.year >= detail.currentYear) continue;
    const weight = yearWeights[agg.year] ?? 0;
    yearRows.push({ year: agg.year, count: agg.count, weight, points: agg.count * weight });
  }
  if (detail.liveCount > 0) {
    const weight = yearWeights[detail.currentYear] ?? 0;
    yearRows.push({
      year: detail.currentYear,
      count: detail.liveCount,
      weight,
      points: detail.liveCount * weight,
    });
  }
  yearRows.sort((a, b) => b.year - a.year);

  const hasYears = yearRows.length > 0;
  const hasAdjustments = detail.adjustments.length > 0;

  return (
    <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
      {hasYears && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            נוכחות לפי שנה
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-400 dark:text-zinc-500">
                <th className="pb-1 text-right font-normal">שנה</th>
                <th className="pb-1 text-center font-normal">מפגשים</th>
                <th className="pb-1 text-center font-normal">משקל</th>
                <th className="pb-1 text-left font-normal" dir="ltr">נקודות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
              {yearRows.map((r) => (
                <tr key={r.year}>
                  <td className="py-1 text-zinc-700 dark:text-zinc-300">
                    {r.year}
                    {r.year === detail.currentYear && (
                      <span className="mr-1.5 text-xs text-zinc-400">(שוטף)</span>
                    )}
                  </td>
                  <td className="py-1 text-center tabular-nums text-zinc-600 dark:text-zinc-400">
                    {r.count}
                  </td>
                  <td className="py-1 text-center tabular-nums text-zinc-600 dark:text-zinc-400">
                    ×{formatScore(r.weight)}
                  </td>
                  <td className="py-1 text-left tabular-nums text-zinc-700 dark:text-zinc-300" dir="ltr">
                    {formatScore(r.points)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasAdjustments && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            התאמות
          </p>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
            {detail.adjustments.map((adj) => (
              <li key={adj.id} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {adj.description}
                  </span>
                  <span className="mr-2 text-xs text-zinc-400">{formatDate(adj.date)}</span>
                </div>
                <span
                  dir="ltr"
                  className={`text-sm font-medium tabular-nums ${
                    adj.points >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {adj.points >= 0 ? "+" : ""}
                  {formatScore(adj.points)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasYears && !hasAdjustments && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">אין נתונים להצגה.</p>
      )}
    </div>
  );
}

export function PrecedenceTable({ rows, details, yearWeights, currentPlayerId }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {rows.map((row, i) => {
        const isMe = currentPlayerId && row.playerId === currentPlayerId;
        const isOpen = openId === row.playerId;
        const detail = details[row.playerId];
        const hasDetail = detail && (detail.aggregates.length > 0 || detail.liveCount > 0 || detail.adjustments.length > 0);

        return (
          <li key={row.playerId}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : row.playerId)}
              className={`flex w-full items-center gap-3 px-5 py-3 text-right transition active:bg-zinc-100 dark:active:bg-zinc-700/50 ${
                isMe
                  ? "bg-blue-50 dark:bg-blue-950/20"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }`}
            >
              {/* Rank */}
              <span className="w-6 shrink-0 text-center text-sm font-medium text-zinc-400 dark:text-zinc-500">
                {i + 1}
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

              {/* Chevron */}
              {hasDetail && (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              )}
              {!hasDetail && <span className="h-4 w-4 shrink-0" />}
            </button>

            {isOpen && hasDetail && (
              <PlayerDetail detail={detail} yearWeights={yearWeights} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
