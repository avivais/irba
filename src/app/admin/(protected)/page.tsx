import { LogOut } from "lucide-react";
import { adminLogoutAction } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default function AdminHomePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="relative mx-auto flex w-full max-w-2xl items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            IRBA
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            ניהול
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            אזור ניהול — תפריט מלא יתווסף בשלב הבא (שחקנים ומפגשים).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto mt-10 w-full max-w-2xl">
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-zinc-500/30 sm:w-auto sm:min-w-[12rem]"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            התנתק
          </button>
        </form>
      </section>
    </div>
  );
}
