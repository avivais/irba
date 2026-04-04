import type { Metadata } from "next";
import Link from "next/link";
import { Users, CalendarDays, FileUp, Settings, ClipboardList, Banknote } from "lucide-react";

export const metadata: Metadata = { title: "ניהול" };

export const dynamic = "force-dynamic";

export default function AdminHomePage() {
  return (
    <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto w-full max-w-2xl md:max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          ניהול
        </h1>
      </header>

      {/* Navigation cards */}
      <nav className="mx-auto mt-8 grid w-full max-w-2xl md:max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/players"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:bg-zinc-100 active:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:active:bg-zinc-800 dark:active:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Users className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">שחקנים</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              שחקנים, קדימות ומשקלות
            </p>
          </div>
        </Link>

        <Link
          href="/admin/sessions"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:bg-zinc-100 active:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:active:bg-zinc-800 dark:active:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <CalendarDays className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">מפגשים</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              נהל מפגשים
            </p>
          </div>
        </Link>

        <Link
          href="/admin/import"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:bg-zinc-100 active:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:active:bg-zinc-800 dark:active:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <FileUp className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">ייבוא נתונים</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              ייבא שחקנים, נוכחות ותשלומים מ-CSV
            </p>
          </div>
        </Link>

        <Link
          href="/admin/config"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:bg-zinc-100 active:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:active:bg-zinc-800 dark:active:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Settings className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">הגדרות</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              מפגשים, מיקום, חיוב ומשחקים
            </p>
          </div>
        </Link>

        <Link
          href="/admin/finance"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:bg-zinc-100 active:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:active:bg-zinc-800 dark:active:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Banknote className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">פיננסים</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              יתרות, תשלומים וחיובים
            </p>
          </div>
        </Link>

        <Link
          href="/admin/audit"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:bg-zinc-100 active:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:active:bg-zinc-800 dark:active:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <ClipboardList className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">לוג פעולות</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              היסטוריית פעולות מלאה
            </p>
          </div>
        </Link>
      </nav>
    </div>
  );
}
