"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Loader2 } from "lucide-react";
import { PlayerDeleteButton } from "@/components/admin/player-delete-button";
import { getPlayerDisplayName } from "@/lib/player-display";
import type { PrecedenceRow } from "@/lib/precedence";

type Player = {
  id: string;
  phone: string;
  playerKind: string;
  positions: string[];
  rank: number | null;
  computedRank: number | null;
  isAdmin: boolean;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  _count: { attendances: number };
};

const KIND_LABEL: Record<string, string> = {
  REGISTERED: "קבוע",
  DROP_IN: "מזדמן",
};

function formatScore(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

type Props = {
  players: Player[];
  precedenceRows: PrecedenceRow[];
  currentYear: number;
  liveCountByPlayerId: Record<string, number>;
  totalSessions: number;
};

export function PlayerList({
  players,
  precedenceRows,
  currentYear,
  liveCountByPlayerId,
  totalSessions,
}: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const precedenceMap = new Map(precedenceRows.map((r) => [r.playerId, r]));

  return (
    <div className="relative">
      {/* Invisible overlay — blocks all clicks while a row is loading */}
      {loadingId && (
        <div className="absolute inset-0 z-30 cursor-wait" aria-hidden />
      )}

      <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
        {players.map((player, idx) => {
          const isLoading = loadingId === player.id;
          const prec = precedenceMap.get(player.id);
          const liveCount = liveCountByPlayerId[player.id] ?? 0;

          return (
            <li
              key={player.id}
              className={`relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-zinc-50 active:bg-zinc-100 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800/50 dark:active:bg-zinc-800 ${
                isLoading ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
              }`}
            >
              {/* Full-row edit link overlay */}
              <Link
                href={`/admin/players/${player.id}/edit`}
                className="absolute inset-0 z-0"
                aria-label={`ערוך את ${getPlayerDisplayName(player)}`}
                onClick={() => setLoadingId(player.id)}
              />

              {/* Left: rank + player info */}
              <div className="pointer-events-none relative z-10 flex min-w-0 items-start gap-3">
                <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-bold text-zinc-400 dark:text-zinc-500">
                  {player.isAdmin ? "" : idx}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {getPlayerDisplayName(player)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-normal ${
                        player.playerKind === "REGISTERED"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                      }`}
                    >
                      {KIND_LABEL[player.playerKind]}
                    </span>
                    {player.positions.length > 0 && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {player.positions.join(", ")}
                      </span>
                    )}
                    {player.isAdmin && (
                      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                        מנהל
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                    <a
                      href={`https://wa.me/${player.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="hover:text-green-600 hover:underline dark:hover:text-green-400"
                    >
                      {player.phone}
                    </a>
                    {!player.isAdmin && (
                      <>
                        {prec && (
                          <>
                            <span>·</span>
                            <span>
                              {currentYear}:{" "}
                              <span dir="ltr" className="text-zinc-600 dark:text-zinc-300">
                                {liveCount}
                                {totalSessions > 0 && (
                                  <span className="text-zinc-400 dark:text-zinc-500">
                                    {" "}({liveCount}/{totalSessions})
                                  </span>
                                )}
                              </span>
                            </span>
                            <span>·</span>
                            <span>
                              ניקוד:{" "}
                              <span dir="ltr" className="font-medium text-zinc-700 dark:text-zinc-200">
                                {formatScore(prec.totalScore)}
                              </span>
                            </span>
                            {player.computedRank !== null && (
                              <>
                                <span>·</span>
                                <span>
                                  דירוג:{" "}
                                  <span dir="ltr" className="font-semibold text-blue-600 dark:text-blue-400">
                                    {player.computedRank.toFixed(1)}
                                  </span>
                                  {player.rank !== null && (
                                    <span className="text-zinc-400 dark:text-zinc-500">
                                      {" "}(ידני: {player.rank})
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-2">
                {isLoading ? (
                  <div className="flex min-h-9 items-center px-3">
                    <Loader2
                      className="h-4 w-4 animate-spin text-zinc-400 dark:text-zinc-500"
                      aria-label="טוען…"
                    />
                  </div>
                ) : (
                  <>
                    <Link
                      href={`/admin/players/${player.id}/edit`}
                      onClick={() => setLoadingId(player.id)}
                      className="pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      עריכה
                    </Link>
                    <div className="pointer-events-auto">
                      <PlayerDeleteButton
                        id={player.id}
                        playerName={getPlayerDisplayName(player)}
                        attendanceCount={player._count.attendances}
                      />
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
