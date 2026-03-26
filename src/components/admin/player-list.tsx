"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Loader2 } from "lucide-react";
import { PlayerDeleteButton } from "@/components/admin/player-delete-button";
import { getPlayerDisplayName } from "@/lib/player-display";

type Player = {
  id: string;
  phone: string;
  playerKind: string;
  positions: string[];
  rank: number | null;
  balance: number;
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

export function PlayerList({ players }: { players: Player[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  return (
    // Wrapper must be `relative` so the freeze overlay is contained here
    <div className="relative">
      {/* Invisible overlay — blocks all clicks while a row is loading */}
      {loadingId && (
        <div className="absolute inset-0 z-30 cursor-wait" aria-hidden />
      )}

      <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
        {players.map((player) => {
          const isLoading = loadingId === player.id;

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

              {/* Player info */}
              <div className="pointer-events-none relative z-10 flex min-w-0 flex-col gap-0.5">
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
                <div className="flex items-center gap-3 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
                  <span dir="ltr">{player.phone}</span>
                  <span>·</span>
                  <span>{player._count.attendances} נוכחויות</span>
                  <span>·</span>
                  <span
                    className={
                      player.balance < 0
                        ? "text-red-500 dark:text-red-400"
                        : player.balance > 0
                          ? "text-green-600 dark:text-green-400"
                          : undefined
                    }
                  >
                    יתרה {player.balance}₪
                  </span>
                  {player.rank != null && (
                    <>
                      <span>·</span>
                      <span>דירוג {player.rank}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions — wrapper is pointer-events-none so empty space falls through to overlay */}
              <div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-2">
                {isLoading ? (
                  /* Spinner replaces action buttons while this row navigates */
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
                      className="pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
