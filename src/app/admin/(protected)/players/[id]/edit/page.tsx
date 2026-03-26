import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlayerForm } from "@/components/admin/player-form";

export const metadata: Metadata = { title: "עריכת שחקן" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminPlayersEditPage({ params }: Props) {
  const { id } = await params;

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          עריכת שחקן
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <PlayerForm
          mode="edit"
          player={{
            id: player.id,
            phone: player.phone,
            playerKind: player.playerKind,
            positions: player.positions,
            rank: player.rank,
            balance: player.balance,
            isAdmin: player.isAdmin,
            nickname: player.nickname,
            firstNameHe: player.firstNameHe,
            lastNameHe: player.lastNameHe,
            firstNameEn: player.firstNameEn,
            lastNameEn: player.lastNameEn,
            birthdate: player.birthdate,
          }}
        />
      </section>
    </div>
  );
}
