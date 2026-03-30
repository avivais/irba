"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Loader2 } from "lucide-react";
import { YearWeightDeleteButton } from "@/components/admin/year-weight-delete-button";

type Weight = { year: number; weight: number };

export function YearWeightList({ weights }: { weights: Weight[] }) {
  const [loadingYear, setLoadingYear] = useState<number | null>(null);

  return (
    <div className="relative">
      {loadingYear !== null && (
        <div className="absolute inset-0 z-30 cursor-wait" aria-hidden />
      )}
      <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
        {weights.map((w) => {
          const isLoading = loadingYear === w.year;
          return (
            <li
              key={w.year}
              className={`relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-zinc-50 active:bg-zinc-100 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800/50 dark:active:bg-zinc-800 ${
                isLoading ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
              }`}
            >
              <Link
                href={`/admin/precedence/weights/${w.year}/edit`}
                className="absolute inset-0 z-0"
                aria-label={`ערוך משקל ${w.year}`}
                onClick={() => setLoadingYear(w.year)}
              />
              <div className="pointer-events-none relative z-10 flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {w.year}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  משקל:{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {w.weight % 1 === 0 ? w.weight.toFixed(1) : w.weight}
                  </span>
                </span>
              </div>
              <div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-2">
                {isLoading ? (
                  <div className="flex min-h-9 items-center px-3">
                    <Loader2
                      className="h-4 w-4 animate-spin text-zinc-400 dark:text-zinc-500"
                      aria-label="טוען…"
                    />
                  </div>
                ) : (
                  <>
                    <Link
                      href={`/admin/precedence/weights/${w.year}/edit`}
                      onClick={() => setLoadingYear(w.year)}
                      className="pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      עריכה
                    </Link>
                    <div className="pointer-events-auto">
                      <YearWeightDeleteButton year={w.year} />
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
