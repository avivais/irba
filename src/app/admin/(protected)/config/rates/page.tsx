import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { HourlyRateDeleteButton } from "@/components/admin/hourly-rate-delete-button";

export const metadata: Metadata = { title: "תעריפי שעה" };

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function formatPrice(p: number): string {
  return `₪${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}`;
}

export default async function HourlyRatesPage() {
  const rates = await prisma.hourlyRate.findMany({
    orderBy: { effectiveFrom: "desc" },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const currentRateId = rates.find((r) => r.effectiveFrom <= today)?.id ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/config"
          className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
        >
          → חזרה להגדרות
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          <Settings className="h-5 w-5" aria-hidden />
          תעריפי שעה
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {rates.length === 0
              ? "אין תעריפים מוגדרים"
              : `${rates.length} תעריפים`}
          </p>
          <Link
            href="/admin/config/rates/new"
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            <Plus className="h-4 w-4" aria-hidden />
            הוסף תעריף
          </Link>
        </div>

        {rates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            לא הוגדרו תעריפים עדיין
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rates.map((rate) => {
              const isCurrent = rate.id === currentRateId;
              const dateStr = rate.effectiveFrom.toISOString().slice(0, 10);
              return (
                <div
                  key={rate.id}
                  className={`flex items-center justify-between gap-4 rounded-2xl border p-4 shadow-sm ${
                    isCurrent
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                      : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {formatPrice(rate.pricePerHour)} / שעה
                      </p>
                      {isCurrent && (
                        <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-green-500">
                          תעריף נוכחי
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      בתוקף מ-{formatDate(rate.effectiveFrom)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/config/rates/${rate.id}/edit`}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
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
      </section>
    </div>
  );
}
