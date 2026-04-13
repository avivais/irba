// Pure rank computation functions — no DB, no Node.js imports.
// Safe to import from tests and client components.

import type { MatchStats } from "@/lib/match-analytics";
export type { MatchStats };

export type RankComponentInput = {
  playerId: string;
  playerKind: "REGISTERED" | "DROP_IN";
  adminRank: number | null;
  /** Normalized 0–100. null = no peer data available. */
  peerScore: number | null;
  /** Normalized 0–100. null = below min-games threshold. */
  winScore: number | null;
  defaultRank: number;
};

export type RankWeights = {
  adminWeight: number;
  peerWeight: number;
  winWeight: number;
};

export type RankBreakdown = {
  computedRank: number | null;
  adminRank: number;
  peerScore: number | null;
  winScore: number | null;
  weights: RankWeights;
  matchStats: MatchStats | null;
  meetsThreshold: boolean;
  /** Minimum games required for win/loss component to apply. 0 = no threshold configured. */
  winThreshold: number;
};

/**
 * Normalize peer position to 0–100.
 * Position 1 (best) → 100, position N (worst) → 0.
 */
export function normalizePeerScore(avgPosition: number, N: number): number {
  if (N <= 1) return 100;
  return (1 - (avgPosition - 1) / (N - 1)) * 100;
}

/** Normalize win ratio (0–1) to 0–100. */
export function normalizeWinScore(winRatio: number): number {
  return winRatio * 100;
}

/**
 * Compute the blended rank for a single player.
 * Returns null only if all effective weights are zero.
 */
export function computeBlendedRank(
  input: RankComponentInput,
  weights: RankWeights,
): number | null {
  const adminRank = input.adminRank ?? input.defaultRank;
  const adminW = weights.adminWeight;

  const isRegistered = input.playerKind === "REGISTERED";

  const effectivePeerW =
    isRegistered && input.peerScore !== null ? weights.peerWeight : 0;

  const effectiveWinW =
    isRegistered && input.winScore !== null ? weights.winWeight : 0;

  const totalW = adminW + effectivePeerW + effectiveWinW;
  if (totalW === 0) return null;

  return (
    adminW * adminRank +
    effectivePeerW * (input.peerScore ?? 0) +
    effectiveWinW * (input.winScore ?? 0)
  ) / totalW;
}
