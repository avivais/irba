import type { Metadata } from "next";
import Link from "next/link";
import { SessionForm } from "@/components/admin/session-form";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { nextDefaultSessionDateISO } from "@/lib/session-validation";

export const metadata: Metadata = { title: "מפגש חדש" };

export const dynamic = "force-dynamic";

export default async function AdminSessionsNewPage() {
  const configs = await getAllConfigs();

  const defaults = {
    date: nextDefaultSessionDateISO(
      parseInt(configs[CONFIG.SESSION_DEFAULT_DAY], 10),
      configs[CONFIG.SESSION_DEFAULT_TIME],
    ),
    maxPlayers: 15,
    durationMinutes: parseInt(configs[CONFIG.SESSION_DEFAULT_DURATION_MIN], 10),
    locationName: configs[CONFIG.LOCATION_NAME],
    locationLat: configs[CONFIG.LOCATION_LAT],
    locationLng: configs[CONFIG.LOCATION_LNG],
  };

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <Link
          href="/admin/sessions"
          className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
        >
          → חזרה לרשימה
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          מפגש חדש
        </h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <SessionForm mode="create" defaults={defaults} />
      </section>
    </div>
  );
}
