import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatGameDate } from "@/lib/format-date";
import { SessionDeleteButton } from "@/components/admin/session-delete-button";
import { SessionToggleButton } from "@/components/admin/session-toggle-button";

export const metadata: Metadata = { title: "מפגשים" };

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const sessions = await prisma.gameSession.findMany({
    orderBy: { date: "desc" },
    include: { _count: { select: { attendances: true } } },
  });

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
          className="flex min-h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          <Plus className="h-4 w-4" aria-hidden />
          מפגש חדש
        </Link>
      </header>

      {/* Session list */}
      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        {sessions.length === 0 ? (
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            אין מפגשים במערכת עדיין.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Session info */}
                <Link
                  href={`/admin/sessions/${session.id}`}
                  className="flex min-w-0 flex-col gap-0.5 hover:opacity-80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formatGameDate(session.date)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-normal ${
                        session.isClosed
                          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      }`}
                    >
                      {session.isClosed ? "סגור" : "פתוח"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>
                      {session._count.attendances} / {session.maxPlayers} נרשמים
                    </span>
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <SessionToggleButton
                    id={session.id}
                    isClosed={session.isClosed}
                  />
                  <Link
                    href={`/admin/sessions/${session.id}/edit`}
                    className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    עריכה
                  </Link>
                  <SessionDeleteButton
                    id={session.id}
                    attendanceCount={session._count.attendances}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
