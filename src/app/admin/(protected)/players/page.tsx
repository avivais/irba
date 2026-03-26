import type { Metadata } from "next";
import Link from "next/link";
import { Users, Plus, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PlayerDeleteButton } from "@/components/admin/player-delete-button";
import { getPlayerDisplayName } from "@/lib/player-display";

export const metadata: Metadata = { title: "שחקנים" };

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  REGISTERED: "קבוע",
  DROP_IN: "מזדמן",
};


export default async function AdminPlayersPage() {
  const players = await prisma.player.findMany({
    orderBy: [{ firstNameHe: "asc" }, { firstNameEn: "asc" }, { nickname: "asc" }],
    include: { _count: { select: { attendances: true } } },
  });

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            → חזרה
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            <Users className="h-5 w-5" aria-hidden />
            שחקנים
          </h1>
        </div>
        <Link
          href="/admin/players/new"
          className="flex min-h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" aria-hidden />
          הוסף שחקן
        </Link>
      </header>

      {/* Player list */}
      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        {players.length === 0 ? (
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            אין שחקנים במערכת עדיין.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
            {players.map((player) => (
              <li
                key={player.id}
                className="relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800/50"
              >
                {/* Full-row edit link overlay */}
                <Link
                  href={`/admin/players/${player.id}/edit`}
                  className="absolute inset-0 z-0"
                  aria-label={`ערוך את ${getPlayerDisplayName(player)}`}
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

                {/* Actions */}
                <div className="relative z-10 flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/players/${player.id}/edit`}
                    className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    עריכה
                  </Link>
                  <PlayerDeleteButton
                    id={player.id}
                    playerName={getPlayerDisplayName(player)}
                    attendanceCount={player._count.attendances}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
