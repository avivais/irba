import type { Metadata } from "next";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PlayerList } from "@/components/admin/player-list";

export const metadata: Metadata = { title: "שחקנים" };

export const dynamic = "force-dynamic";


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
          <PlayerList players={players} />
        )}
      </section>
    </div>
  );
}
