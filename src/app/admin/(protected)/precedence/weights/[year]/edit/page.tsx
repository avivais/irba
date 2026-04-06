import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { YearWeightForm } from "@/components/admin/year-weight-form";

export const metadata: Metadata = { title: "עריכת משקל" };

type Props = { params: Promise<{ year: string }> };

export default async function AdminWeightsEditPage({ params }: Props) {
  const { year: yearParam } = await params;
  const year = parseInt(yearParam, 10);
  if (isNaN(year)) notFound();

  const weight = await prisma.yearWeight.findUnique({ where: { year } });
  if (!weight) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/precedence/weights"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          עריכת משקל — {weight.year}
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <YearWeightForm mode="edit" year={weight.year} weight={weight.weight} />
      </section>
    </div>
  );
}
