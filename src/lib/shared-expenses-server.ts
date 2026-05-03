/**
 * Shared-expense engine — DB orchestrators (server-only).
 *
 * Imports prisma. Do NOT import this module from client components.
 * Pure functions and types live in shared-expenses.ts.
 */

import { computePlayerBalances } from "./balance";
import { getPlayerDisplayName } from "./player-display";
import {
  computeEligible,
  rollingCutoff,
  type EligibilityCandidate,
  type EligiblePlayer,
  type FindEligibleInput,
  type RosterPlayer,
} from "./shared-expenses";

/**
 * Find players who meet the attendance threshold over the rolling window.
 *
 * Combines two attendance sources, matching the precedence list:
 *   - Live segment (currentYear ∩ window): GameSession + Attendance rows.
 *   - Historical segment (years < currentYear, intersected with window):
 *     PlayerYearAggregate counts. Per-year denominator = max aggregate count
 *     for that year (heuristic: most-attending player went to ~all sessions).
 *
 * The boundary year (cutoff's year) contributes a fraction equal to the share
 * of that year covered by the window.
 */
export async function findEligiblePlayers(
  input: FindEligibleInput,
): Promise<EligiblePlayer[]> {
  const { prisma } = await import("./prisma");
  const now = input.now ?? new Date();
  const cutoff = rollingCutoff(input.lookbackYears, now);

  const currentYear = now.getFullYear();
  const cutoffYear = cutoff.getFullYear();
  const currentYearStart = new Date(currentYear, 0, 1);
  const liveStart = cutoff > currentYearStart ? cutoff : currentYearStart;

  const historicalYears: { year: number; fraction: number }[] = [];
  for (let y = cutoffYear; y < currentYear; y++) {
    if (y === cutoffYear) {
      const yearStart = new Date(y, 0, 1).getTime();
      const yearEnd = new Date(y + 1, 0, 1).getTime();
      const f = (yearEnd - cutoff.getTime()) / (yearEnd - yearStart);
      historicalYears.push({ year: y, fraction: Math.max(0, Math.min(1, f)) });
    } else {
      historicalYears.push({ year: y, fraction: 1 });
    }
  }

  const [liveSessionsTotal, liveAttendances, aggregates, players] = await Promise.all([
    prisma.gameSession.count({
      where: { date: { gte: liveStart, lte: now } },
    }),
    prisma.attendance.findMany({
      where: { gameSession: { date: { gte: liveStart, lte: now } } },
      select: { playerId: true },
    }),
    historicalYears.length > 0
      ? prisma.playerYearAggregate.findMany({
          where: { year: { in: historicalYears.map((y) => y.year) } },
          select: { playerId: true, year: true, count: true },
        })
      : Promise.resolve(
          [] as { playerId: string; year: number; count: number }[],
        ),
    prisma.player.findMany({
      select: {
        id: true,
        playerKind: true,
        firstNameHe: true,
        lastNameHe: true,
        firstNameEn: true,
        lastNameEn: true,
        nickname: true,
        phone: true,
      },
    }),
  ]);

  if (players.length === 0) return [];

  const yearMaxCount = new Map<number, number>();
  const playerYearCounts = new Map<string, Map<number, number>>();
  for (const a of aggregates) {
    const cur = yearMaxCount.get(a.year) ?? 0;
    if (a.count > cur) yearMaxCount.set(a.year, a.count);
    let pmap = playerYearCounts.get(a.playerId);
    if (!pmap) {
      pmap = new Map();
      playerYearCounts.set(a.playerId, pmap);
    }
    pmap.set(a.year, a.count);
  }

  let historicalSessionsTotal = 0;
  for (const { year, fraction } of historicalYears) {
    historicalSessionsTotal += (yearMaxCount.get(year) ?? 0) * fraction;
  }
  const sessionsTotal = liveSessionsTotal + historicalSessionsTotal;
  if (sessionsTotal === 0) return [];

  const liveAttendedByPlayer = new Map<string, number>();
  for (const a of liveAttendances) {
    liveAttendedByPlayer.set(
      a.playerId,
      (liveAttendedByPlayer.get(a.playerId) ?? 0) + 1,
    );
  }

  const balances = await computePlayerBalances(players.map((p) => p.id));

  const candidates: EligibilityCandidate[] = players.map((p) => {
    const live = liveAttendedByPlayer.get(p.id) ?? 0;
    let historical = 0;
    const pmap = playerYearCounts.get(p.id);
    if (pmap) {
      for (const { year, fraction } of historicalYears) {
        historical += (pmap.get(year) ?? 0) * fraction;
      }
    }
    return {
      playerId: p.id,
      name: getPlayerDisplayName(p),
      playerKind: p.playerKind,
      currentBalance: balances.get(p.id)?.balance ?? 0,
      sessionsAttended: live + historical,
    };
  });

  return computeEligible(
    candidates,
    sessionsTotal,
    input.minAttendancePct,
    input.eligibilityPool,
  );
}

/**
 * Full roster for the manual-add dropdown in the preview UI.
 * Includes every player (REGISTERED + DROP_IN) with their current balance.
 */
export async function listAllPlayersForManualAdd(): Promise<RosterPlayer[]> {
  const { prisma } = await import("./prisma");
  const players = await prisma.player.findMany({
    select: {
      id: true,
      playerKind: true,
      firstNameHe: true,
      lastNameHe: true,
      firstNameEn: true,
      lastNameEn: true,
      nickname: true,
      phone: true,
    },
  });
  if (players.length === 0) return [];

  const balances = await computePlayerBalances(players.map((p) => p.id));

  const roster = players.map((p) => ({
    playerId: p.id,
    name: getPlayerDisplayName(p),
    playerKind: p.playerKind,
    currentBalance: balances.get(p.id)?.balance ?? 0,
  }));
  roster.sort((a, b) => a.name.localeCompare(b.name));
  return roster;
}
