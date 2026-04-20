import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getConfigInt, CONFIG } from "@/lib/config";
import { SessionList } from "@/components/admin/session-list";
import { DateFieldIL } from "@/components/admin/date-field-il";

export const metadata: Metadata = { title: "מפגשים" };

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string; archived?: string };

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const showArchived = sp.archived === "1";
  const fromDate = sp.from ? new Date(sp.from) : undefined;
  const toDate = sp.to ? new Date(sp.to + "T23:59:59") : undefined;

  const [sessions, minPlayers] = await Promise.all([
    prisma.gameSession.findMany({
    where: {
      isArchived: showArchived ? true : false,
      ...(fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
      orderBy: { date: "desc" },
      include: { _count: { select: { attendances: true } } },
    }),
    getConfigInt(CONFIG.SESSION_MIN_PLAYERS),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
          >
            → חזרה
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            <CalendarDays className="h-5 w-5" aria-hidden />
            מפגשים
          </h1>
        </div>
        <Link
          href="/admin/sessions/new"
          aria-label="מפגש חדש"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      {/* Filters */}
      <form
        method="GET"
        className="mx-auto mt-5 w-full max-w-2xl md:max-w-4xl flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="sessions-filter-from" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">מתאריך</label>
          <DateFieldIL
            id="sessions-filter-from"
            name="from"
            defaultValue={sp.from ?? ""}
            aria-label="מתאריך"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sessions-filter-to" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">עד תאריך</label>
          <DateFieldIL
            id="sessions-filter-to"
            name="to"
            defaultValue={sp.to ?? ""}
            aria-label="עד תאריך"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
          <input
            name="archived"
            type="checkbox"
            value="1"
            defaultChecked={showArchived}
            className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
          />
          הצג ארכיון
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          חפש
        </button>
        {(sp.from || sp.to || showArchived) && (
          <Link
            href="/admin/sessions"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            נקה
          </Link>
        )}
      </form>

      {/* Session list */}
      <section className="mx-auto mt-4 w-full max-w-2xl md:max-w-4xl">
        {sessions.length === 0 ? (
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            אין מפגשים להצגה.
          </p>
        ) : (
          <SessionList sessions={sessions} minPlayers={minPlayers} />
        )}
      </section>
    </div>
  );
}
