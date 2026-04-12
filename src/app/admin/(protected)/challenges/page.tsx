import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Pencil, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import { ChallengeDeleteButton } from "@/components/admin/challenge-delete-button";

export const metadata: Metadata = { title: "תחרויות" };

export const dynamic = "force-dynamic";

export default async function AdminChallengesPage() {
  const challenges = await prisma.challenge.findMany({
    orderBy: { number: "desc" },
    include: {
      winner: {
        select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
      },
    },
  });

  const activeChallenge = challenges.find((c) => !c.isClosed);
  const closedChallenges = challenges.filter((c) => c.isClosed);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-zinc-500 dark:text-zinc-400" aria-hidden />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">תחרויות</h1>
        </div>
        {/* Only show "New" button if there is no active competition */}
        {!activeChallenge && (
          <Link
            href="/admin/challenges/new"
            aria-label="פתח תחרות חדשה"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Link>
        )}
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl space-y-6">
        {/* Active competition */}
        {activeChallenge ? (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              תחרות פעילה
            </h2>
            <ChallengeRow challenge={activeChallenge} isActive />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              אין תחרות פעילה כרגע.{" "}
              <Link href="/admin/challenges/new" className="text-blue-600 underline dark:text-blue-400">
                פתח תחרות חדשה
              </Link>
            </p>
          </div>
        )}

        {/* History */}
        {closedChallenges.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              היסטוריה
            </h2>
            <ul className="flex flex-col gap-3">
              {closedChallenges.map((c) => (
                <ChallengeRow key={c.id} challenge={c} isActive={false} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

type ChallengeRowProps = {
  challenge: Awaited<ReturnType<typeof prisma.challenge.findMany>>[number] & {
    winner: { id: string; firstNameHe: string | null; lastNameHe: string | null; firstNameEn: string | null; lastNameEn: string | null; nickname: string | null; phone: string } | null;
  };
  isActive: boolean;
};

function ChallengeRow({ challenge: c, isActive }: ChallengeRowProps) {
  const winnerName = c.winner ? getPlayerDisplayName(c.winner) : null;
  const startDateFormatted = new Date(c.startDate).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            סיבוב {c.number}
          </span>
          {isActive ? (
            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              פעיל
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              סגור
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {c.sessionCount} מפגשים · החל מ-{startDateFormatted} · סף {c.minMatchesPct}% משחקים
        </p>
        {winnerName && (
          <p className="mt-0.5 text-sm font-medium text-amber-600 dark:text-amber-400">
            🏆 זוכה: {winnerName} — כניסה חינם
          </p>
        )}
        {!isActive && !winnerName && c.isClosed && (
          <p className="mt-0.5 text-sm text-zinc-400 dark:text-zinc-500">
            ללא זוכה
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!c.isClosed && (
          <Link
            href={`/admin/challenges/${c.id}/edit`}
            className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            עריכה
          </Link>
        )}
        {!c.isClosed && <ChallengeDeleteButton id={c.id} number={c.number} />}
      </div>
    </li>
  );
}
