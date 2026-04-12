import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChallengeForm } from "@/components/admin/challenge-form";
import { updateChallengeAction } from "@/app/admin/(protected)/challenges/actions";

export const metadata: Metadata = { title: "עריכת תחרות" };

export default async function EditChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) notFound();

  const boundAction = updateChallengeAction.bind(null, id);
  const startDateStr = challenge.startDate.toISOString().slice(0, 10);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/challenges"
          className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          עריכת תחרות · סיבוב {challenge.number}
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {challenge.isClosed ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            לא ניתן לערוך תחרות שהסתיימה.
          </p>
        ) : (
          <ChallengeForm
            action={boundAction}
            defaultStartDate={startDateStr}
            defaultSessionCount={challenge.sessionCount}
            defaultMinMatchesPct={challenge.minMatchesPct}
            submitLabel="שמור שינויים"
          />
        )}
      </section>
    </div>
  );
}
