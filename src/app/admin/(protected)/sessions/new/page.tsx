import Link from "next/link";
import { SessionForm } from "@/components/admin/session-form";

export default function AdminSessionsNewPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3">
        <Link
          href="/admin/sessions"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← חזרה לרשימה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          מפגש חדש
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <SessionForm mode="create" />
      </section>
    </div>
  );
}
