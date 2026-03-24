import type { Metadata } from "next";
import Link from "next/link";
import { Scale, Plus, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { YearWeightDeleteButton } from "@/components/admin/year-weight-delete-button";

export const metadata: Metadata = { title: "משקלות" };
export const dynamic = "force-dynamic";

export default async function AdminWeightsPage() {
  const weights = await prisma.yearWeight.findMany({ orderBy: { year: "desc" } });

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/precedence"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            → חזרה לקדימות
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            <Scale className="h-5 w-5" aria-hidden />
            משקלות שנתיות
          </h1>
        </div>
        <Link
          href="/admin/precedence/weights/new"
          className="flex min-h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" aria-hidden />
          הוסף שנה
        </Link>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        {weights.length === 0 ? (
          <p className="text-center text-zinc-500">
            אין משקלות שנתיות עדיין.{" "}
            <Link
              href="/admin/precedence/weights/new"
              className="text-zinc-700 underline hover:no-underline dark:text-zinc-300"
            >
              הוסף את הראשון
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            {weights.map((w) => (
              <li
                key={w.year}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {w.year}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    משקל:{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      ×{w.weight % 1 === 0 ? w.weight.toFixed(1) : w.weight}
                    </span>
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/precedence/weights/${w.year}/edit`}
                    className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    עריכה
                  </Link>
                  <YearWeightDeleteButton year={w.year} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
