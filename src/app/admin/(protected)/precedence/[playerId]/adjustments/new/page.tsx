import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdjustmentForm } from "@/components/admin/adjustment-form";

export const metadata: Metadata = { title: "התאמה חדשה" };

type Props = { params: Promise<{ playerId: string }> };

export default async function NewAdjustmentPage({ params }: Props) {
  const { playerId } = await params;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { name: true },
  });
  if (!player) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href={`/admin/precedence/${playerId}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה ל{player.name}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          הוסף בונוס / קנס
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <AdjustmentForm mode="create" playerId={playerId} />
      </section>
    </div>
  );
}
