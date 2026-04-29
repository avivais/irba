import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "חיובים משותפים" };
export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

const POOL_LABEL: Record<string, string> = {
  REGISTERED_ONLY: "רשומים בלבד",
  ALL_PLAYERS: "כל השחקנים",
};

export default async function SharedExpensesIndexPage() {
  const expenses = await prisma.sharedExpense.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      totalAmount: true,
      createdAt: true,
      revertedAt: true,
      eligibilityPool: true,
      _count: { select: { charges: true } },
    },
  });

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/finance"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          חיובים משותפים
        </h1>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-2xl md:max-w-4xl flex-col gap-4">
        <div className="flex items-center justify-end">
          <Link
            href="/admin/finance/shared-expenses/new"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" aria-hidden />
            חיוב חדש
          </Link>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {expenses.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              אין עדיין חיובים משותפים.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {expenses.map((e) => {
                const reverted = e.revertedAt !== null;
                return (
                  <li
                    key={e.id}
                    className="relative flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <Link
                      href={`/admin/finance/shared-expenses/${e.id}`}
                      className="absolute inset-0"
                      aria-label={e.title}
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {e.title}
                        {reverted && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            מבוטל
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(e.createdAt)} · {e._count.charges} שחקנים ·{" "}
                        {POOL_LABEL[e.eligibilityPool] ?? e.eligibilityPool}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        reverted
                          ? "text-zinc-400 line-through dark:text-zinc-500"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}
                      dir="ltr"
                    >
                      ₪{e.totalAmount}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
