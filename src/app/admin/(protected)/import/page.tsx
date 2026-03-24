import type { Metadata } from "next";
import Link from "next/link";
import { Users, BarChart2, CreditCard } from "lucide-react";

export const metadata: Metadata = { title: "ייבוא נתונים" };

export default function AdminImportPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה לניהול
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">ייבוא נתונים</h1>
      </header>

      <nav className="mx-auto mt-8 grid w-full max-w-2xl md:max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/admin/import/players"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Users className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">שחקנים</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              ייבא רשימת שחקנים מ-CSV
            </p>
          </div>
        </Link>

        <Link
          href="/admin/import/aggregates"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <BarChart2 className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">נוכחות עבר</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              ייבא ספירות נוכחות לפי שנה
            </p>
          </div>
        </Link>

        <Link
          href="/admin/import/payments"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <CreditCard className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">תשלומים</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              ייבא היסטוריית תשלומים מ-CSV
            </p>
          </div>
        </Link>
      </nav>
    </div>
  );
}
