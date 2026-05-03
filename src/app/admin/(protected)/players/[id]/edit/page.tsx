import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PlayerForm } from "@/components/admin/player-form";
import { getPlayerDisplayName } from "@/lib/player-display";
import { AggregateDeleteButton } from "@/components/admin/aggregate-delete-button";
import { AggregateUpsertForm } from "@/components/admin/aggregate-upsert-form";
import { AdjustmentDeleteButton } from "@/components/admin/adjustment-delete-button";
import { computePrecedenceScores } from "@/lib/precedence";
import { computePlayerBalance } from "@/lib/balance";
import { PlayerPayments } from "@/components/admin/player-payments";
import { PlayerRetroButton } from "@/components/admin/player-retro-button";
import { getPlayerRankBreakdown } from "@/lib/computed-rank";

export const metadata: Metadata = { title: "עריכת שחקן" };

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
}

function formatScore(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export default async function AdminPlayersEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from === "finance" ? "/admin/finance" : "/admin/players";
  const backLabel = "→ חזרה";
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear + 1, 0, 1);

  const [player, yearWeights, allLiveAttendances, allPlayers, playerPayments, balance, playerCharges, rankBreakdown] =
    await Promise.all([
      prisma.player.findUnique({
        where: { id },
        include: {
          yearAggregates: { orderBy: { year: "desc" } },
          adjustments: { orderBy: { date: "desc" } },
        },
      }),
      prisma.yearWeight.findMany(),
      prisma.attendance.findMany({
        where: { gameSession: { date: { gte: yearStart, lt: yearEnd } } },
        select: { playerId: true },
      }),
      prisma.player.findMany({
        select: {
          id: true,
          nickname: true,
          firstNameHe: true,
          lastNameHe: true,
          firstNameEn: true,
          lastNameEn: true,
          phone: true,
          yearAggregates: true,
          adjustments: { select: { points: true } },
        },
      }),
      prisma.payment.findMany({
        where: { playerId: id },
        orderBy: { date: "desc" },
        select: { id: true, date: true, amount: true, method: true, description: true },
      }),
      computePlayerBalance(id),
      prisma.sessionCharge.findMany({
        where: { playerId: id },
        orderBy: { session: { date: "desc" } },
        select: {
          id: true,
          amount: true,
          calculatedAmount: true,
          chargeType: true,
          session: { select: { id: true, date: true } },
        },
      }),
      getPlayerRankBreakdown(id).catch(() => null),
    ]);

  if (!player) notFound();

  const liveCountMap = new Map<string, number>();
  for (const a of allLiveAttendances) {
    liveCountMap.set(a.playerId, (liveCountMap.get(a.playerId) ?? 0) + 1);
  }

  const liveCount = liveCountMap.get(id) ?? 0;

  const precedenceRows = computePrecedenceScores(
    allPlayers.map((p) => ({
      id: p.id,
      playerName: getPlayerDisplayName(p),
      aggregates: p.yearAggregates,
      liveCount: liveCountMap.get(p.id) ?? 0,
      adjustments: p.adjustments,
    })),
    yearWeights,
    currentYear,
  );

  const playerRank = precedenceRows.findIndex((r) => r.playerId === id) + 1;
  const playerPrecedence = precedenceRows.find((r) => r.playerId === id);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-start gap-3">
        <Link
          href={backHref}
          className="mt-1 shrink-0 text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
        >
          {backLabel}
        </Link>
        <span className="mt-1 text-zinc-300 dark:text-zinc-600">|</span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {getPlayerDisplayName(player)}
          </h1>
          {playerPrecedence && (
            <p className="mt-0.5 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
              <span dir="ltr">
                מקום {playerRank} · ניקוד {formatScore(playerPrecedence.totalScore)}
              </span>
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-2xl md:max-w-4xl flex-col gap-6">
        {/* 1 — Player details form */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <PlayerForm
            mode="edit"
            player={{
              id: player.id,
              phone: player.phone,
              playerKind: player.playerKind,
              positions: player.positions,
              rank: player.rank,
              isAdmin: player.isAdmin,
              nickname: player.nickname,
              firstNameHe: player.firstNameHe,
              lastNameHe: player.lastNameHe,
              firstNameEn: player.firstNameEn,
              lastNameEn: player.lastNameEn,
              birthdate: player.birthdate,
              email: player.email,
              nationalId: player.nationalId,
            }}
          />
        </section>

        {/* 2 — Payments */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            תשלומים
          </h2>
          <PlayerPayments
            playerId={id}
            payments={playerPayments}
            balance={balance}
          />
        </section>

        {/* 3 — Session charges */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">חיובי מפגשים</h2>
          {(() => {
            // Trailing consecutive DROP_IN streak — eligible only for REGISTERED-kind players
            if (player.playerKind !== "REGISTERED") return null;
            let streak = 0;
            for (const c of playerCharges) {
              if (c.chargeType === "DROP_IN") streak++;
              else break;
            }
            if (streak === 0) return null;
            return <PlayerRetroButton playerId={id} streakCount={streak} />;
          })()}
          {playerCharges.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">אין חיובים עדיין.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {playerCharges.map((charge) => {
                const hasOverride = charge.amount !== charge.calculatedAmount;
                const typeLabel =
                  charge.chargeType === "REGISTERED" ? "קבוע"
                  : charge.chargeType === "DROP_IN" ? "מזדמן"
                  : "עקיפה";
                return (
                  <li key={charge.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/admin/sessions/${charge.session.id}`}
                        className="text-sm font-medium text-zinc-800 hover:underline dark:text-zinc-200"
                      >
                        {formatDate(charge.session.date)}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                          {typeLabel}
                        </span>
                        {hasOverride && (
                          <span className="text-amber-600 dark:text-amber-400">
                            עקיפה (מחושב: ₪{charge.calculatedAmount})
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="shrink-0 tabular-nums font-semibold text-red-600 dark:text-red-400"
                      dir="ltr"
                    >
                      -₪{charge.amount}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 4 — Computed rank + win/loss stats */}
        {rankBreakdown && (() => {
          // Pre-compute per-component contributions for a clear formula display
          const adminW = rankBreakdown.weights.adminWeight;
          const peerW = rankBreakdown.peerScore !== null ? rankBreakdown.weights.peerWeight : 0;
          const winW = rankBreakdown.winScore !== null ? rankBreakdown.weights.winWeight : 0;
          const denominator = adminW + peerW + winW;
          const isDropIn = player.playerKind === "DROP_IN";
          return (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">דירוג מחושב</h2>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                  {rankBreakdown.computedRank !== null ? rankBreakdown.computedRank.toFixed(1) : "—"}
                </span>
              </div>

              {/* Component table */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {/* Admin row — always active */}
                <div className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="w-16 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">מנהל</span>
                  <span className="flex-1 tabular-nums text-zinc-500 dark:text-zinc-400" dir="ltr">{rankBreakdown.adminRank.toFixed(1)}</span>
                  <span className="text-xs text-zinc-400">× {adminW}</span>
                  <span className="w-14 text-left tabular-nums font-medium text-zinc-800 dark:text-zinc-200" dir="ltr">
                    = {(rankBreakdown.adminRank * adminW).toFixed(1)}
                  </span>
                </div>

                {/* Peer row */}
                {!isDropIn && (
                  <div className={`flex items-center justify-between gap-2 py-2 text-sm ${rankBreakdown.peerScore === null ? "opacity-40" : ""}`}>
                    <span className="w-16 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">שחקנים</span>
                    <span className="flex-1 tabular-nums text-zinc-500 dark:text-zinc-400" dir="ltr">
                      {rankBreakdown.peerScore !== null ? rankBreakdown.peerScore.toFixed(1) : "—"}
                    </span>
                    {rankBreakdown.peerScore !== null ? (
                      <>
                        <span className="text-xs text-zinc-400">× {rankBreakdown.weights.peerWeight}</span>
                        <span className="w-14 text-left tabular-nums font-medium text-zinc-800 dark:text-zinc-200" dir="ltr">
                          = {(rankBreakdown.peerScore * rankBreakdown.weights.peerWeight).toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="w-32 text-left text-xs text-zinc-400">אין נתוני שחקנים</span>
                    )}
                  </div>
                )}

                {/* Win row */}
                {!isDropIn && (
                  <div className={`flex items-center justify-between gap-2 py-2 text-sm ${rankBreakdown.winScore === null ? "opacity-40" : ""}`}>
                    <span className="w-16 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">ניצחונות</span>
                    <span className="flex-1 tabular-nums text-zinc-500 dark:text-zinc-400" dir="ltr">
                      {rankBreakdown.winScore !== null ? rankBreakdown.winScore.toFixed(1) : "—"}
                    </span>
                    {rankBreakdown.winScore !== null ? (
                      <>
                        <span className="text-xs text-zinc-400">× {rankBreakdown.weights.winWeight}</span>
                        <span className="w-14 text-left tabular-nums font-medium text-zinc-800 dark:text-zinc-200" dir="ltr">
                          = {(rankBreakdown.winScore * rankBreakdown.weights.winWeight).toFixed(1)}
                        </span>
                      </>
                    ) : rankBreakdown.meetsThreshold === false && rankBreakdown.winThreshold > 0 ? (
                      <span className="w-32 text-left text-xs text-zinc-400">
                        חסרים {rankBreakdown.winThreshold - (rankBreakdown.matchStats?.total ?? 0)} משחקים
                      </span>
                    ) : (
                      <span className="w-32 text-left text-xs text-zinc-400">אין נתוני משחק</span>
                    )}
                  </div>
                )}
              </div>

              {/* Formula summary */}
              {rankBreakdown.computedRank !== null && (
                <div className="mt-2 text-xs text-zinc-400 dark:text-zinc-500" dir="ltr">
                  סכום ÷ {denominator} = {rankBreakdown.computedRank.toFixed(1)}
                </div>
              )}

              {/* Win/loss stats */}
              {rankBreakdown.matchStats && (
                <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">{rankBreakdown.matchStats.total} משחקים</span>
                      <span className="text-green-700 dark:text-green-400">{rankBreakdown.matchStats.wins} נצ׳</span>
                      <span className="text-red-600 dark:text-red-400">{rankBreakdown.matchStats.losses} הפ׳</span>
                      {rankBreakdown.matchStats.ties > 0 && (
                        <span className="text-zinc-400">{rankBreakdown.matchStats.ties} ת׳</span>
                      )}
                      <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300" dir="ltr">
                        {(rankBreakdown.matchStats.winRatio * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" dir="ltr">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${(rankBreakdown.matchStats.winRatio * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        rankBreakdown.meetsThreshold
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                      }`}
                    >
                      {rankBreakdown.meetsThreshold
                        ? "מעל הסף"
                        : rankBreakdown.winThreshold > 0
                          ? `מתחת לסף (${rankBreakdown.matchStats?.total ?? 0}/${rankBreakdown.winThreshold})`
                          : "מתחת לסף"}
                    </span>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* 5 — Attendance: current year + historical merged */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">נוכחות</h2>

          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
              שנה נוכחית — {currentYear}
              <span className="mr-1 font-normal">(נספר אוטומטית)</span>
            </p>
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {liveCount}
              <span className="mr-1 text-base font-normal text-zinc-500 dark:text-zinc-400">
                נוכחויות
              </span>
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">שנים קודמות</p>
            {player.yearAggregates.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                אין נתונים היסטוריים עדיין.
              </p>
            ) : (
              <ul className="mb-3 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {player.yearAggregates.map((agg) => (
                  <li
                    key={agg.year}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                        {agg.year}
                      </span>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {agg.count} נוכחויות
                      </span>
                    </div>
                    <AggregateDeleteButton playerId={id} year={agg.year} />
                  </li>
                ))}
              </ul>
            )}
            <AggregateUpsertForm playerId={id} currentYear={currentYear} />
          </div>
        </section>

        {/* 6 — Bonuses / Fines */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              בונוסים / קנסות
            </h2>
            <Link
              href={`/admin/precedence/${id}/adjustments/new`}
              className="flex min-h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              הוסף
            </Link>
          </div>

          {player.adjustments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              אין בונוסים / קנסות עדיין.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {player.adjustments.map((adj) => (
                <li
                  key={adj.id}
                  className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        dir="ltr"
                        className={`tabular-nums font-semibold ${
                          adj.points > 0
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {adj.points > 0 ? "+" : ""}
                        {adj.points % 1 === 0 ? adj.points : adj.points.toFixed(1)}
                      </span>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {adj.description}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDate(adj.date)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/precedence/${id}/adjustments/${adj.id}/edit`}
                      className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      עריכה
                    </Link>
                    <AdjustmentDeleteButton playerId={id} adjId={adj.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
