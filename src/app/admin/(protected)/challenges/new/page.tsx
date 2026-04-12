import type { Metadata } from "next";
import Link from "next/link";
import { getAllConfigs } from "@/lib/config";
import { CONFIG } from "@/lib/config-keys";
import { ChallengeForm } from "@/components/admin/challenge-form";
import { createChallengeAction } from "@/app/admin/(protected)/challenges/actions";

export const metadata: Metadata = { title: "תחרות חדשה" };

export default async function NewChallengePage() {
  const config = await getAllConfigs();
  const defaultSessionCount = parseInt(config[CONFIG.COMPETITION_SESSION_COUNT] ?? "6", 10);
  const defaultMinMatchesThreshold = parseInt(config[CONFIG.COMPETITION_MIN_MATCHES_THRESHOLD] ?? "10", 10);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/challenges"
          className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
        >
          → חזרה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">תחרות חדשה</h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <ChallengeForm
          action={createChallengeAction}
          defaultSessionCount={defaultSessionCount}
          defaultMinMatchesThreshold={defaultMinMatchesThreshold}
          submitLabel="פתח תחרות"
        />
      </section>
    </div>
  );
}
