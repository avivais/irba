import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { getAllConfigs } from "@/lib/config";
import { ConfigForm } from "@/components/admin/config-form";

export const metadata: Metadata = { title: "הגדרות" };

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const values = await getAllConfigs();

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
        <ConfigForm values={values} />
      </section>
    </div>
  );
}
