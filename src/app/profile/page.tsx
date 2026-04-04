import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/prisma";
import { PlayerNav } from "@/components/player-nav";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ThemeSelector } from "@/components/theme-selector";

export const metadata: Metadata = { title: "אזור אישי" };

export const dynamic = "force-dynamic";

function getDisplayName(player: {
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  nickname: string | null;
  phone: string;
}): string {
  if (player.firstNameHe) {
    return [player.firstNameHe, player.lastNameHe].filter(Boolean).join(" ");
  }
  if (player.firstNameEn) {
    return [player.firstNameEn, player.lastNameEn].filter(Boolean).join(" ");
  }
  return player.nickname ?? player.phone;
}

function formatSessionDate(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function ProfilePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/");

  const player = await prisma.player.findUnique({
    where: { id: session.playerId },
    select: {
      id: true,
      phone: true,
      passwordHash: true,
      firstNameHe: true,
      lastNameHe: true,
      firstNameEn: true,
      lastNameEn: true,
      nickname: true,
      isAdmin: true,
      attendances: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          gameSession: {
            select: {
              id: true,
              date: true,
              isClosed: true,
              isArchived: true,
              maxPlayers: true,
            },
          },
        },
      },
    },
  });

  if (!player) redirect("/");

  const displayName = getDisplayName(player);

  return (
    <>
      <PlayerNav />
      <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        <header className="mx-auto w-full max-w-lg md:max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {displayName}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {player.phone}
          </p>
        </header>

        <main className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-6 md:max-w-2xl">
          {/* Attendance history */}
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                נוכחות אחרונה
              </h2>
            </div>
            {player.attendances.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                אין רשומות נוכחות עדיין.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {player.attendances.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                      {formatSessionDate(att.gameSession.date)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {att.gameSession.isArchived
                        ? "ארכיון"
                        : att.gameSession.isClosed
                          ? "סגור"
                          : "פתוח"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Change password */}
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {player.passwordHash ? "שינוי סיסמה" : "הגדרת סיסמה"}
              </h2>
            </div>
            <div className="px-5 py-4">
              <ChangePasswordForm hasPassword={!!player.passwordHash} />
            </div>
          </section>

          {/* Appearance */}
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">עיצוב</h2>
            </div>
            <div className="px-5 py-4">
              <ThemeSelector />
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
