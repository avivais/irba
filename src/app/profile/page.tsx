import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/prisma";
import { computePlayerBalance } from "@/lib/balance";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { PlayerNav } from "@/components/player-nav";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ThemeSelector } from "@/components/theme-selector";
import { AccountStatement } from "@/components/account-statement";
import { RegulationsViewer } from "@/components/regulations-viewer";
import { MatchStatsSection } from "@/components/match-stats-section";
import { fetchPlayerMatchAnalytics } from "@/app/profile/analytics";
import { PeerRatingBanner } from "@/components/peer-rating-banner";
import { checkPendingPeerRatingAction } from "@/app/admin/(protected)/ranking/actions";

export const metadata: Metadata = { title: "אזור אישי" };

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  CASH: "מזומן",
  PAYBOX: "Paybox",
  BIT: "Bit",
  BANK_TRANSFER: "העברה",
  OTHER: "אחר",
};

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

const VALID_PER = [10, 20, 50] as const;
type PerPage = (typeof VALID_PER)[number];
type StatementType = "all" | "payments" | "charges";

type Props = {
  searchParams: Promise<{ page?: string; per?: string; type?: string }>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const session = await getPlayerSession();
  if (!session) redirect("/");

  const rawParams = await searchParams;
  const typeParam = (rawParams.type ?? "all") as StatementType;
  const statementType: StatementType = ["all", "payments", "charges"].includes(typeParam)
    ? typeParam
    : "all";
  const perRaw = parseInt(rawParams.per ?? "20", 10);
  const per: PerPage = (VALID_PER as readonly number[]).includes(perRaw)
    ? (perRaw as PerPage)
    : 20;
  const page = Math.max(1, parseInt(rawParams.page ?? "1", 10));

  const [player, balance, allPayments, allCharges, allConfigs, analytics, pendingRating] = await Promise.all([
    prisma.player.findUnique({
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
    }),
    computePlayerBalance(session.playerId),
    prisma.payment.findMany({
      where: { playerId: session.playerId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, amount: true, method: true, description: true },
    }),
    prisma.sessionCharge.findMany({
      where: { playerId: session.playerId },
      orderBy: { session: { date: "asc" } },
      select: {
        id: true,
        amount: true,
        chargeType: true,
        session: { select: { date: true } },
      },
    }),
    getAllConfigs(),
    fetchPlayerMatchAnalytics(session.playerId),
    checkPendingPeerRatingAction(),
  ]);

  if (!player) redirect("/");

  const displayName = getDisplayName(player);

  // Build unified statement sorted ascending, compute running balance, then reverse
  type Entry =
    | { kind: "payment"; id: string; date: Date; amount: number; method: string; description: string | null }
    | { kind: "charge"; id: string; date: Date; amount: number; chargeType: string };

  const entries: Entry[] = [
    ...allPayments.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      date: p.date,
      amount: p.amount,
      method: p.method,
      description: p.description,
    })),
    ...allCharges.map((c) => ({
      kind: "charge" as const,
      id: c.id,
      date: c.session.date,
      amount: c.amount,
      chargeType: c.chargeType,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Running balance (ascending)
  let running = 0;
  const withBalance = entries.map((e) => {
    running += e.kind === "payment" ? e.amount : -e.amount;
    return { ...e, runningBalance: running };
  });

  // Reverse to most-recent-first
  const reversed = withBalance.reverse();

  // Filter by type
  const filtered =
    statementType === "payments"
      ? reversed.filter((e) => e.kind === "payment")
      : statementType === "charges"
        ? reversed.filter((e) => e.kind === "charge")
        : reversed;

  const totalEntries = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / per));
  const safePage = Math.min(page, totalPages);
  const pageEntries = filtered.slice((safePage - 1) * per, safePage * per);

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
          {/* Peer rating banner */}
          {pendingRating.hasPending && (
            <PeerRatingBanner year={pendingRating.year} />
          )}

          {/* Balance */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">יתרה</p>
            <p
              dir="ltr"
              className={`mt-1 text-3xl font-bold tabular-nums ${
                balance.balance > 0
                  ? "text-green-600 dark:text-green-400"
                  : balance.balance < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {balance.balance > 0 ? "+" : ""}₪{balance.balance}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              שולם ₪{balance.totalPaid} · חויב ₪{balance.totalCharged}
            </p>
          </section>

          {/* Match stats */}
          <MatchStatsSection analytics={analytics} />

          {/* Account statement */}
          <AccountStatement
            entries={pageEntries}
            totalEntries={totalEntries}
            page={safePage}
            totalPages={totalPages}
            per={per}
            statementType={statementType}
            methodLabel={METHOD_LABEL}
          />

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

          {/* Settings — password, regulations, appearance */}
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">הגדרות</h2>
            </div>

            {/* Password */}
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {player.passwordHash ? "שינוי סיסמה" : "הגדרת סיסמה"}
              </p>
              <ChangePasswordForm hasPassword={!!player.passwordHash} />
            </div>

            {/* Regulations */}
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">תקנון</p>
              <RegulationsViewer
                templateText={allConfigs[CONFIG.REGULATIONS_TEXT]}
                configValues={allConfigs}
              />
            </div>

            {/* Appearance */}
            <div className="px-5 py-4">
              <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">מראה</p>
              <ThemeSelector />
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
