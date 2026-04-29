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
 * Sessions denominator: GameSession with date in window AND !isArchived AND isCharged.
 * "Played" = the player has a SessionCharge row for that session (excludes
 * waitlist-only attendance, matches existing balance accounting).
 */
export async function findEligiblePlayers(
  input: FindEligibleInput,
): Promise<EligiblePlayer[]> {
  const { prisma } = await import("./prisma");
  const now = input.now ?? new Date();
  const cutoff = rollingCutoff(input.lookbackYears, now);

  const sessionsTotal = await prisma.gameSession.count({
    where: {
      date: { gte: cutoff, lte: now },
      isArchived: false,
      isCharged: true,
    },
  });
  if (sessionsTotal === 0) return [];

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

  const playerIds = players.map((p) => p.id);

  const chargesInWindow = await prisma.sessionCharge.findMany({
    where: {
      playerId: { in: playerIds },
      session: {
        date: { gte: cutoff, lte: now },
        isArchived: false,
        isCharged: true,
      },
    },
    select: { playerId: true, sessionId: true },
  });

  const attendedByPlayer = new Map<string, Set<string>>();
  for (const c of chargesInWindow) {
    let set = attendedByPlayer.get(c.playerId);
    if (!set) {
      set = new Set();
      attendedByPlayer.set(c.playerId, set);
    }
    set.add(c.sessionId);
  }

  const balances = await computePlayerBalances(playerIds);

  const candidates: EligibilityCandidate[] = players.map((p) => ({
    playerId: p.id,
    name: getPlayerDisplayName(p),
    playerKind: p.playerKind,
    currentBalance: balances.get(p.id)?.balance ?? 0,
    sessionsAttended: attendedByPlayer.get(p.id)?.size ?? 0,
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
