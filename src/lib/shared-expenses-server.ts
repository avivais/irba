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
 *   - Live segment (currentYear ∩ window): Attendance rows on GameSessions.
 *   - Historical segment (years < currentYear, intersected with window):
 *     PlayerYearAggregate counts. The boundary year (cutoff's year)
 *     contributes a fraction equal to its overlap with the window.
 *
 * Denominator = max attendance count across all players in the window. By
 * definition the most-active player hits 100%; everyone else's pct is their
 * share relative to that top.
 *
 * Admin players are always included (treated as 100%) — they run every
 * session, so the system doesn't capture their attendance via Attendance rows.
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

  const [liveAttendances, aggregates, players] = await Promise.all([
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
        isAdmin: true,
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

  const playerYearCounts = new Map<string, Map<number, number>>();
  for (const a of aggregates) {
    let pmap = playerYearCounts.get(a.playerId);
    if (!pmap) {
      pmap = new Map();
      playerYearCounts.set(a.playerId, pmap);
    }
    pmap.set(a.year, a.count);
  }

  const liveAttendedByPlayer = new Map<string, number>();
  for (const a of liveAttendances) {
    liveAttendedByPlayer.set(
      a.playerId,
      (liveAttendedByPlayer.get(a.playerId) ?? 0) + 1,
    );
  }

  const balances = await computePlayerBalances(players.map((p) => p.id));

  const playerAttended = new Map<string, number>();
  for (const p of players) {
    const live = liveAttendedByPlayer.get(p.id) ?? 0;
    let historical = 0;
    const pmap = playerYearCounts.get(p.id);
    if (pmap) {
      for (const { year, fraction } of historicalYears) {
        historical += (pmap.get(year) ?? 0) * fraction;
      }
    }
    playerAttended.set(p.id, live + historical);
  }

  let sessionsTotal = 0;
  for (const v of playerAttended.values()) {
    if (v > sessionsTotal) sessionsTotal = v;
  }
  if (sessionsTotal === 0) return [];

  const candidates: EligibilityCandidate[] = players.map((p) => ({
    playerId: p.id,
    name: getPlayerDisplayName(p),
    playerKind: p.playerKind,
    currentBalance: balances.get(p.id)?.balance ?? 0,
    sessionsAttended: playerAttended.get(p.id) ?? 0,
    isAdmin: p.isAdmin,
  }));

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
