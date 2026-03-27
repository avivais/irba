import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { getAllConfigs } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { ConfigForm } from "@/components/admin/config-form";
import { HourlyRateDeleteButton } from "@/components/admin/hourly-rate-delete-button";

export const metadata: Metadata = { title: "הגדרות" };

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function formatPrice(p: number): string {
  return `₪${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}`;
}

export default async function AdminConfigPage() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [values, rates] = await Promise.all([
    getAllConfigs(),
    prisma.hourlyRate.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ]);

  const currentRateId = rates.find((r) => r.effectiveFrom <= today)?.id ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          <Settings className="h-5 w-5" aria-hidden />
          הגדרות
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">

        {/* ── Hourly rates ────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            תעריף שעתי
          </h2>

          {rates.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">לא הוגדרו תעריפים עדיין</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rates.map((rate) => {
                const isCurrent = rate.id === currentRateId;
                return (
                  <div
                    key={rate.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      isCurrent
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                        : "border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatPrice(rate.pricePerHour)} / שעה
                      </span>
                      {isCurrent && (
                        <span className="mr-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-green-500">
                          נוכחי
                        </span>
                      )}
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        מ-{formatDate(rate.effectiveFrom)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/config/rates/${rate.id}/edit`}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
                      >
                        ערוך
                      </Link>
                      <HourlyRateDeleteButton id={rate.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <Link
              href="/admin/config/rates/new"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
            >
              <Plus className="h-4 w-4" aria-hidden />
              הוסף תעריף
            </Link>
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800" />

        {/* ── Config form ─────────────────────────────────── */}
        <div className="mt-8">
          <ConfigForm values={values} />
        </div>
      </section>
    </div>
  );
}
