"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function PeerRatingBanner({ year }: { year: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-900/20">
      <p className="text-sm text-amber-800 dark:text-amber-300">
        <span className="font-medium">שאלון דירוג שחקנים {year} פתוח.</span>{" "}
        עדיין לא הגשת —{" "}
        <Link
          href="/ranking/submit"
          className="underline underline-offset-2 hover:no-underline"
        >
          לחץ כאן לדירוג
        </Link>
        .
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="סגור"
        className="shrink-0 text-amber-500 hover:text-amber-700 dark:text-amber-400"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
