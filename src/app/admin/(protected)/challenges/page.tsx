import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Pencil, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { METRIC_LABELS } from "@/lib/challenge-validation";
import type { ChallengeMetric } from "@/lib/challenge-analytics";
import { ChallengeDeleteButton } from "@/components/admin/challenge-delete-button";
import { ChallengeToggleButton } from "@/components/admin/challenge-toggle-button";

export const metadata: Metadata = { title: "תחרויות" };

export const dynamic = "force-dynamic";

export default async function AdminChallengesPage() {
  const challenges = await prisma.challenge.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-zinc-500 dark:text-zinc-400" aria-hidden />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">תחרויות</h1>
        </div>
        <Link
          href="/admin/challenges/new"
          aria-label="הוסף תחרות"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        {challenges.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            אין תחרויות עדיין.{" "}
            <Link href="/admin/challenges/new" className="text-blue-600 underline dark:text-blue-400">
              הוסף תחרות ראשונה
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {challenges.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {c.title}
                    </span>
                    {c.isActive ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        פעיל
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        הסתיים
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {METRIC_LABELS[c.metric as ChallengeMetric]}
                    {" · "}
                    {c.roundCount === 0 ? "כל הזמן" : `${c.roundCount} סבבים`}
                    {" · "}
                    סף {c.eligibilityMinPct}%
                    {c.prize ? ` · פרס: ${c.prize}` : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <ChallengeToggleButton id={c.id} isActive={c.isActive} />
                  <Link
                    href={`/admin/challenges/${c.id}/edit`}
                    className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    עריכה
                  </Link>
                  <ChallengeDeleteButton id={c.id} title={c.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
