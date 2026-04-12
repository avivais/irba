import type { Metadata } from "next";
import Link from "next/link";
import { fetchPeerRatingPageDataAction } from "./actions";
import { PeerRatingForm } from "@/components/peer-rating-form";

export const metadata: Metadata = { title: "דירוג שחקנים" };
export const dynamic = "force-dynamic";

export default async function PeerRatingSubmitPage() {
  const data = await fetchPeerRatingPageDataAction();

  if (data.type === "not_logged_in") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">יש להתחבר כדי לגשת לדף זה.</p>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  if (data.type === "drop_in") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          שאלון דירוג שחקנים זמין לשחקנים קבועים בלבד.
        </p>
        <Link
          href="/profile"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
        >
          → חזרה לפרופיל
        </Link>
      </div>
    );
  }

  if (data.type === "no_session") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">אין שאלון דירוג פעיל כרגע.</p>
        <Link
          href="/profile"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
        >
          → חזרה לפרופיל
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-6 flex items-center gap-4">
          <Link
            href="/profile"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            → חזרה לפרופיל
          </Link>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <PeerRatingForm
            sessionId={data.sessionId}
            year={data.year}
            players={data.players}
            existingOrder={data.existingOrder}
          />
        </div>
      </div>
    </div>
  );
}
