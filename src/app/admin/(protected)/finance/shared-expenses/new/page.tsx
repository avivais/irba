import type { Metadata } from "next";
import Link from "next/link";
import { SharedExpenseForm } from "@/components/admin/shared-expense-form";

export const metadata: Metadata = { title: "חיוב משותף חדש" };
export const dynamic = "force-dynamic";

export default function NewSharedExpensePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/finance/shared-expenses"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          חיוב משותף חדש
        </h1>
      </header>

      <div className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        <SharedExpenseForm />
      </div>
    </div>
  );
}
