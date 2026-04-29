import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import { computePlayerBalances } from "@/lib/balance";

export const metadata: Metadata = { title: "פיננסים" };
export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  CASH: "מזומן",
  PAYBOX: "Paybox",
  BIT: "Bit",
  BANK_TRANSFER: "העברה",
  OTHER: "אחר",
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

export default async function AdminFinancePage() {
  const [players, recentPayments, recentCharges] =
    await Promise.all([
      prisma.player.findMany({
        where: { isAdmin: false },
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
      }),
      prisma.payment.findMany({
        orderBy: { date: "desc" },
        take: 20,
        select: {
          id: true,
          date: true,
          amount: true,
          method: true,
          description: true,
          player: {
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
        },
      }),
      prisma.sessionCharge.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          amount: true,
          chargeType: true,
          session: { select: { date: true } },
          player: {
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
        },
      }),
    ]);

  const balances = await computePlayerBalances(players.map((p) => p.id));

  const playerRows = players.map((p) => {
    const b = balances.get(p.id);
    return {
      ...p,
      totalPaid: b?.totalPaid ?? 0,
      totalCharged: b?.totalCharged ?? 0,
      balance: b?.balance ?? 0,
    };
  });

  // Sort: biggest debtors first
  playerRows.sort((a, b) => a.balance - b.balance);

  const totalPaid = playerRows.reduce((s, r) => s + r.totalPaid, 0);
  const totalCharged = playerRows.reduce((s, r) => s + r.totalCharged, 0);
  const totalBalance = totalPaid - totalCharged;

  const debtors = playerRows.filter((r) => r.balance < 0);
  const credits = playerRows.filter((r) => r.balance > 0);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">פיננסים</h1>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-2xl md:max-w-4xl flex-col gap-6">
        {/* Summary */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "סה״כ שולם", value: totalPaid, color: "text-green-700 dark:text-green-400" },
            { label: "סה״כ חויב", value: totalCharged, color: "text-zinc-700 dark:text-zinc-300" },
            {
              label: "יתרה כוללת",
              value: totalBalance,
              color:
                totalBalance >= 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600 dark:text-red-400",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
              <span className={`text-xl font-bold tabular-nums ${color}`} dir="ltr">
                ₪{value}
              </span>
            </div>
          ))}
        </section>

        {/* Shared expenses entry */}
        <section>
          <Link
            href="/admin/finance/shared-expenses"
            className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
          >
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-zinc-500 dark:text-zinc-400" aria-hidden />
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                חיובים משותפים
              </span>
            </div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">→</span>
          </Link>
        </section>

        {/* Debtors */}
        {debtors.length > 0 && (
          <section className="rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-900/40 dark:bg-zinc-900">
            <div className="border-b border-red-100 px-5 py-4 dark:border-red-900/30">
              <h2 className="font-semibold text-red-700 dark:text-red-400">
                חייבים ({debtors.length})
              </h2>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {debtors.map((p) => (
                <li key={p.id} className="relative flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <Link href={`/admin/players/${p.id}/edit?from=finance`} className="absolute inset-0" aria-label={getPlayerDisplayName(p)} />
                  <span className="min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {getPlayerDisplayName(p)}
                  </span>
                  <span
                    className="shrink-0 font-semibold tabular-nums text-red-600 dark:text-red-400"
                    dir="ltr"
                  >
                    -₪{Math.abs(p.balance)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Credits */}
        {credits.length > 0 && (
          <section className="rounded-2xl border border-green-200 bg-white shadow-sm dark:border-green-900/40 dark:bg-zinc-900">
            <div className="border-b border-green-100 px-5 py-4 dark:border-green-900/30">
              <h2 className="font-semibold text-green-700 dark:text-green-400">
                זכות ({credits.length})
              </h2>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {credits.map((p) => (
                <li key={p.id} className="relative flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <Link href={`/admin/players/${p.id}/edit?from=finance`} className="absolute inset-0" aria-label={getPlayerDisplayName(p)} />
                  <span className="min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {getPlayerDisplayName(p)}
                  </span>
                  <span
                    className="shrink-0 font-semibold tabular-nums text-green-700 dark:text-green-400"
                    dir="ltr"
                  >
                    +₪{p.balance}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* All players */}
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">כל השחקנים</h2>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {playerRows.map((p) => (
              <li key={p.id} className="relative flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <Link href={`/admin/players/${p.id}/edit?from=finance`} className="absolute inset-0" aria-label={getPlayerDisplayName(p)} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {getPlayerDisplayName(p)}
                  </span>
                  <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                    שולם ₪{p.totalPaid} · חויב ₪{p.totalCharged}
                  </span>
                </div>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    p.balance > 0
                      ? "text-green-700 dark:text-green-400"
                      : p.balance < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-500 dark:text-zinc-400"
                  }`}
                  dir="ltr"
                >
                  {p.balance > 0 ? "+" : ""}₪{p.balance}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent payments */}
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">תשלומים אחרונים</h2>
          </div>
          {recentPayments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">אין תשלומים.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                      {getPlayerDisplayName(p.player)}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDate(p.date)} · {METHOD_LABEL[p.method] ?? p.method}
                      {p.description && ` · ${p.description}`}
                    </span>
                  </div>
                  <span
                    className="shrink-0 font-semibold tabular-nums text-green-700 dark:text-green-400"
                    dir="ltr"
                  >
                    +₪{p.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent charges */}
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">חיובים אחרונים</h2>
          </div>
          {recentCharges.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">אין חיובים.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentCharges.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                      {getPlayerDisplayName(c.player)}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDate(c.session.date)}
                    </span>
                  </div>
                  <span
                    className="shrink-0 font-semibold tabular-nums text-red-600 dark:text-red-400"
                    dir="ltr"
                  >
                    -₪{c.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
