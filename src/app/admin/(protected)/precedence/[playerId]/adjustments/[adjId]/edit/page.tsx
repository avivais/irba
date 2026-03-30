import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdjustmentForm } from "@/components/admin/adjustment-form";
import { getPlayerDisplayName } from "@/lib/player-display";

export const metadata: Metadata = { title: "עריכת התאמה" };

type Props = { params: Promise<{ playerId: string; adjId: string }> };

export default async function EditAdjustmentPage({ params }: Props) {
  const { playerId, adjId } = await params;

  const [player, adj] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true } }),
    prisma.playerAdjustment.findUnique({ where: { id: adjId } }),
  ]);

  if (!player || !adj || adj.playerId !== playerId) notFound();

  // Format date as YYYY-MM-DD for the date input
  const dateStr = adj.date.toISOString().slice(0, 10);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href={`/admin/players/${playerId}/edit`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה ל{getPlayerDisplayName(player)}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          עריכת התאמה
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <AdjustmentForm
          mode="edit"
          playerId={playerId}
          adjustment={{
            id: adj.id,
            date: dateStr,
            points: adj.points,
            description: adj.description,
          }}
        />
      </section>
    </div>
  );
}
