import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { WaBotStatus } from "@/components/admin/wa-bot-status";
import { WaSendForm } from "@/components/admin/wa-send-form";

export const metadata: Metadata = { title: "וואטסאפ" };
export const dynamic = "force-dynamic";

export default async function WaPage() {
  await requireAdmin();
  const configs = await getAllConfigs();
  const groupJid = configs[CONFIG.WA_GROUP_JID];

  return (
    <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm font-medium text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            → חזרה
          </Link>
        </div>

        <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          וואטסאפ
        </h1>

        <div className="flex flex-col gap-8">
          {/* Bot status */}
          <section>
            <WaBotStatus />
          </section>

          {/* Manual send */}
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              שליחת הודעה לקבוצה
            </h2>

            {groupJid ? (
              <WaSendForm groupJid={groupJid} />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                הגדר Group JID ב
                <Link href="/admin/config" className="underline hover:text-zinc-700 dark:hover:text-zinc-200">
                  הגדרות
                </Link>
                {" "}כדי לשלוח הודעות לקבוצה.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
