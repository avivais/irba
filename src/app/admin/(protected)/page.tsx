import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Users, CalendarDays, Trophy } from "lucide-react";
import { adminLogoutAction } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "ניהול" };

export const dynamic = "force-dynamic";

export default function AdminHomePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="relative mx-auto flex w-full max-w-2xl md:max-w-4xl items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            IRBA
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            ניהול
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <ThemeToggle />
        </div>
      </header>

      {/* Navigation cards */}
      <nav className="mx-auto mt-8 grid w-full max-w-2xl md:max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/players"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Users className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">שחקנים</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              הוסף, ערוך ומחק שחקנים
            </p>
          </div>
        </Link>

        <Link
          href="/admin/sessions"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus:ring-zinc-500/30"
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
          href="/admin/precedence"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus:ring-zinc-500/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Trophy className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">קדימות</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              רשימת קדימות ומשקלות
            </p>
          </div>
        </Link>
      </nav>

      <section className="mx-auto mt-8 w-full max-w-2xl md:max-w-4xl">
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-zinc-500/30 sm:w-auto sm:min-w-[12rem]"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            התנתק
          </button>
        </form>
      </section>
    </div>
  );
}
