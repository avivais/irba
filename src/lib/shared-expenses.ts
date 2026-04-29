/**
 * Shared-expense engine — pure functions and types.
 *
 * No DB imports here. The DB orchestrators live in shared-expenses-server.ts
 * so this module is safe to import from client components.
 */

import type { PlayerKind } from "@prisma/client";

export type EligibilityPool = "REGISTERED_ONLY" | "ALL_PLAYERS";

export type EligiblePlayer = {
  playerId: string;
  name: string;
  playerKind: PlayerKind;
  sessionsAttended: number;
  sessionsTotal: number;
  attendancePct: number; // 0..1
  currentBalance: number;
};

export type RosterPlayer = {
  playerId: string;
  name: string;
  playerKind: PlayerKind;
  currentBalance: number;
};

export type FindEligibleInput = {
  lookbackYears: number;
  minAttendancePct: number; // 0..1
  eligibilityPool: EligibilityPool;
  /** Override "now" for testing. */
  now?: Date;
};

export type ShareSplit = {
  share: number;
  remainder: number;
  perPlayer: number[]; // length == playerCount; sums to totalAmount
};

/**
 * Split a positive integer total among playerCount players.
 *
 * share     = floor(total / count)
 * remainder = total - share * count   (distributed +1 to first `remainder` players)
 *
 * Sum of perPlayer === totalAmount exactly. Caller is responsible for the
 * stable ordering that decides which players get the +1.
 */
export function computeSharedExpenseShares(
  totalAmount: number,
  playerCount: number,
): ShareSplit {
  if (playerCount <= 0) {
    return { share: 0, remainder: 0, perPlayer: [] };
  }
  const share = Math.floor(totalAmount / playerCount);
  const remainder = totalAmount - share * playerCount;
  const perPlayer = new Array<number>(playerCount).fill(share);
  for (let i = 0; i < remainder; i++) perPlayer[i] += 1;
  return { share, remainder, perPlayer };
}

/** Rolling cutoff date: now minus lookbackYears (handles fractional years). */
export function rollingCutoff(lookbackYears: number, now: Date): Date {
  const cutoff = new Date(now);
  const ms = now.getTime() - lookbackYears * 365.25 * 24 * 60 * 60 * 1000;
  cutoff.setTime(ms);
  return cutoff;
}

export type EligibilityCandidate = {
  playerId: string;
  name: string;
  playerKind: PlayerKind;
  currentBalance: number;
  sessionsAttended: number;
};

/**
 * Pure helper: filter candidates by attendance threshold and eligibility pool,
 * sort for stable display.
 */
export function computeEligible(
  candidates: EligibilityCandidate[],
  sessionsTotal: number,
  minAttendancePct: number,
  eligibilityPool: EligibilityPool,
): EligiblePlayer[] {
  if (sessionsTotal === 0) return [];

  const filtered: EligiblePlayer[] = [];
  for (const c of candidates) {
    if (eligibilityPool === "REGISTERED_ONLY" && c.playerKind !== "REGISTERED") {
      continue;
    }
    const attendancePct = c.sessionsAttended / sessionsTotal;
    if (attendancePct < minAttendancePct) continue;
    filtered.push({
      playerId: c.playerId,
      name: c.name,
      playerKind: c.playerKind,
      sessionsAttended: c.sessionsAttended,
      sessionsTotal,
      attendancePct,
      currentBalance: c.currentBalance,
    });
  }

  filtered.sort((a, b) => {
    if (b.attendancePct !== a.attendancePct) {
      return b.attendancePct - a.attendancePct;
    }
    return a.name.localeCompare(b.name);
  });

  return filtered;
}
