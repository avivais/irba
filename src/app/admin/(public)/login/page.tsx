import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin-login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "כניסת מנהל" };

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="relative mx-auto w-full max-w-md">
        <div className="absolute start-0 top-0 z-10">
          <ThemeToggle />
        </div>
        <div className="px-2 pt-1 text-center">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            IRBA
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            כניסת מנהל
          </h1>
        </div>
      </header>

      <section className="mx-auto mt-10 w-full max-w-md">
        <AdminLoginForm />
      </section>
    </div>
  );
}
