import type { Metadata } from "next";
import Link from "next/link";
import { fetchRankingSessionsAction } from "./actions";
import { RankingSessionPanel } from "@/components/admin/ranking-session-panel";

export const metadata: Metadata = { title: "דירוג שחקנים" };
export const dynamic = "force-dynamic";

export default async function AdminRankingPage() {
  const sessions = await fetchRankingSessionsAction();

  return (
    <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl md:max-w-4xl">
        <header className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            → חזרה
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            דירוג שחקנים
          </h1>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            שאלון דירוג עמיתים נפתח פעם בשנה. שחקנים קבועים מדרגים את כל שאר השחקנים הקבועים מהטוב ביותר לחלש ביותר.
            עם סגירת השאלון, הדירוג המחושב של כל שחקן מתעדכן אוטומטית.
          </p>
          <RankingSessionPanel sessions={sessions} />
        </div>
      </div>
    </div>
  );
}
