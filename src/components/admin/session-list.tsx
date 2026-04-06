"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { formatGameDate } from "@/lib/format-date";
import { SessionDeleteButton } from "@/components/admin/session-delete-button";
import { SessionArchiveButton } from "@/components/admin/session-archive-button";

type Session = {
  id: string;
  date: Date;
  maxPlayers: number;
  isClosed: boolean;
  isArchived: boolean;
  _count: { attendances: number };
};

export function SessionList({ sessions, minPlayers = 10 }: { sessions: Session[]; minPlayers?: number }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  return (
    <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
      {sessions.map((session) => {
        const isLoading = loadingId === session.id;
        return (
          <li
            key={session.id}
            className={`relative flex flex-col gap-2 px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between ${
              isLoading
                ? "bg-zinc-50 dark:bg-zinc-800/50"
                : "hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800/50 dark:active:bg-zinc-800"
            }`}
          >
            {/* Full-row invisible link */}
            <Link
              href={`/admin/sessions/${session.id}`}
              className="absolute inset-0 z-0"
              onClick={() => setLoadingId(session.id)}
              aria-label={formatGameDate(session.date)}
            />

            {/* Content */}
            <div className="pointer-events-none z-10 flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatGameDate(session.date)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-normal ${
                    session.isArchived
                      ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                      : session.isClosed
                      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  }`}
                >
                  {session.isArchived ? "ארכיון" : session.isClosed ? "סגור" : "פתוח"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span
                  dir="ltr"
                  className={
                    session._count.attendances >= session.maxPlayers
                      ? "text-green-700 dark:text-green-400"
                      : session._count.attendances < minPlayers
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {session._count.attendances} / {session.maxPlayers} נרשמים
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pointer-events-auto relative z-10 flex shrink-0 flex-wrap items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              ) : (
                <>
                  <SessionArchiveButton id={session.id} isArchived={session.isArchived} />
                  <SessionDeleteButton
                    id={session.id}
                    attendanceCount={session._count.attendances}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
