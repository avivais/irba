import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import { RevertSharedExpenseButton } from "@/components/admin/revert-shared-expense-button";

export const metadata: Metadata = { title: "חיוב משותף" };
export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

const POOL_LABEL: Record<string, string> = {
  REGISTERED_ONLY: "שחקנים רשומים בלבד",
  ALL_PLAYERS: "כל השחקנים",
};

export default async function SharedExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = await prisma.sharedExpense.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      totalAmount: true,
      lookbackYears: true,
      minAttendancePct: true,
      eligibilityPool: true,
      createdAt: true,
      revertedAt: true,
      createdBy: {
        select: {
          id: true,
          nickname: true,
          firstNameHe: true,
          lastNameHe: true,
          firstNameEn: true,
          lastNameEn: true,
          phone: true,
        },
      },
      charges: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          amount: true,
          manuallyAdded: true,
          player: {
            select: {
              id: true,
              nickname: true,
              firstNameHe: true,
              lastNameHe: true,
              firstNameEn: true,
              lastNameEn: true,
              phone: true,
              playerKind: true,
            },
          },
        },
      },
    },
  });

  if (!expense) notFound();

  const reverted = expense.revertedAt !== null;
  const minAttendancePctDisplay = Math.round(expense.minAttendancePct * 100);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/finance/shared-expenses"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {expense.title}
          {reverted && (
            <span className="ms-2 rounded bg-zinc-100 px-2 py-0.5 align-middle text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              מבוטל
            </span>
          )}
        </h1>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-2xl md:max-w-4xl flex-col gap-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">סכום</dt>
              <dd
                className={`text-lg font-semibold tabular-nums ${
                  reverted
                    ? "text-zinc-400 line-through dark:text-zinc-500"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
                dir="ltr"
              >
                ₪{expense.totalAmount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">נוצר ב-</dt>
              <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                {formatDateTime(expense.createdAt)}
                {" · "}
                {getPlayerDisplayName(expense.createdBy)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">קהל יעד</dt>
              <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                {POOL_LABEL[expense.eligibilityPool] ?? expense.eligibilityPool}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                קריטריונים
              </dt>
              <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                {expense.lookbackYears} שנים, מינימום {minAttendancePctDisplay}%
              </dd>
            </div>
            {expense.description && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">תיאור</dt>
                <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                  {expense.description}
                </dd>
              </div>
            )}
            {reverted && expense.revertedAt && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">בוטל ב-</dt>
                <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                  {formatDateTime(expense.revertedAt)}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              חיובים פרטניים ({expense.charges.length})
            </h2>
          </div>
          {expense.charges.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              אין חיובים. הרשומה הזו בוטלה.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {expense.charges.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100">
                    {getPlayerDisplayName(c.player)}
                    {c.player.playerKind === "DROP_IN" && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        דופ-אין
                      </span>
                    )}
                    {c.manuallyAdded && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        ידני
                      </span>
                    )}
                  </span>
                  <span
                    className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
                    dir="ltr"
                  >
                    ₪{c.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!reverted && (
          <RevertSharedExpenseButton id={expense.id} title={expense.title} />
        )}
      </div>
    </div>
  );
}
