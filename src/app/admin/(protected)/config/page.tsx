import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";
import { getAllConfigs } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { ConfigForm } from "@/components/admin/config-form";

export const metadata: Metadata = { title: "הגדרות" };

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const [values, currentRate] = await Promise.all([
    getAllConfigs(),
    prisma.hourlyRate.findFirst({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
      select: { pricePerHour: true, effectiveFrom: true },
    }),
  ]);

  const rateLabel = currentRate
    ? `₪${currentRate.pricePerHour % 1 === 0 ? currentRate.pricePerHour.toFixed(0) : currentRate.pricePerHour.toFixed(1)} / שעה`
    : "לא הוגדר";

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

      {/* Hourly rate quick-link */}
      <div className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        <Link
          href="/admin/config/rates"
          className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:bg-zinc-100 active:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:active:bg-zinc-800 dark:focus:ring-zinc-500/30"
        >
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">תעריף שעתי</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              תעריף נוכחי: <span className="font-medium text-zinc-700 dark:text-zinc-300">{rateLabel}</span>
            </p>
          </div>
          <ChevronLeft className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
        </Link>
      </div>

      <section className="mx-auto mt-4 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <ConfigForm values={values} />
      </section>
    </div>
  );
}
