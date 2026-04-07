export type MatchRecord = {
  id: string;
  sessionId: string;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  scoreA: number;
  scoreB: number;
  createdAt: Date;
};

export type MatchStats = {
  wins: number;
  losses: number;
  ties: number;
  total: number;
  winRatio: number; // 0–1, ties excluded from denominator
};

export type MonthlyRecord = {
  /** YYYY-MM */
  month: string;
  wins: number;
  losses: number;
  ties: number;
};

export type SessionRecord = {
  sessionId: string;
  date: Date;
  wins: number;
  losses: number;
  ties: number;
};

export type RoundRecord = {
  /** 1-based round number */
  round: number;
  /** Date of the first session in this round */
  startDate: Date;
  /** Date of the last session in this round (may be same as startDate for single-session rounds) */
  endDate: Date;
  wins: number;
  losses: number;
  ties: number;
};

export type TeammateAffinity = {
  teammateId: string;
  sharedWins: number;
  totalMatchesTogether: number;
};

function outcomeFor(
  playerId: string,
  match: MatchRecord,
): "win" | "loss" | "tie" | null {
  const inA = match.teamAPlayerIds.includes(playerId);
  const inB = match.teamBPlayerIds.includes(playerId);
  if (!inA && !inB) return null;

  if (match.scoreA === match.scoreB) return "tie";
  const teamAWon = match.scoreA > match.scoreB;
  if (inA) return teamAWon ? "win" : "loss";
  return teamAWon ? "loss" : "win";
}

export function computeMatchStats(
  playerId: string,
  matches: MatchRecord[],
): MatchStats {
  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const m of matches) {
    const outcome = outcomeFor(playerId, m);
    if (outcome === "win") wins++;
    else if (outcome === "loss") losses++;
    else if (outcome === "tie") ties++;
  }

  const decided = wins + losses;
  const winRatio = decided === 0 ? 0 : wins / decided;

  return { wins, losses, ties, total: wins + losses + ties, winRatio };
}

export function computeMonthlyBreakdown(
  playerId: string,
  matches: MatchRecord[],
): MonthlyRecord[] {
  const map = new Map<string, MonthlyRecord>();

  for (const m of matches) {
    const outcome = outcomeFor(playerId, m);
    if (outcome === null) continue;

    const d = m.createdAt;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!map.has(month)) map.set(month, { month, wins: 0, losses: 0, ties: 0 });
    const rec = map.get(month)!;
    if (outcome === "win") rec.wins++;
    else if (outcome === "loss") rec.losses++;
    else rec.ties++;
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function computeSessionBreakdown(
  playerId: string,
  matches: MatchRecord[],
): SessionRecord[] {
  const map = new Map<string, SessionRecord>();

  for (const m of matches) {
    const outcome = outcomeFor(playerId, m);
    if (outcome === null) continue;

    if (!map.has(m.sessionId)) {
      map.set(m.sessionId, {
        sessionId: m.sessionId,
        date: m.createdAt,
        wins: 0,
        losses: 0,
        ties: 0,
      });
    }
    const rec = map.get(m.sessionId)!;
    // Keep the earliest createdAt as the session date anchor
    if (m.createdAt < rec.date) rec.date = m.createdAt;
    if (outcome === "win") rec.wins++;
    else if (outcome === "loss") rec.losses++;
    else rec.ties++;
  }

  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Groups matches into rounds based on session order.
 *
 * @param sessionOrder - Map of sessionId → 0-based sequential index (sorted by date ascending)
 * @param sessionDates - Map of sessionId → session date (for start/end date labels)
 * @param roundSize    - Number of sessions per round
 */
export function computeRoundBreakdown(
  playerId: string,
  matches: MatchRecord[],
  sessionOrder: Map<string, number>,
  sessionDates: Map<string, Date>,
  roundSize: number,
): RoundRecord[] {
  if (roundSize < 1) roundSize = 1;

  const map = new Map<number, { wins: number; losses: number; ties: number; sessionIndices: number[] }>();

  for (const m of matches) {
    const outcome = outcomeFor(playerId, m);
    if (outcome === null) continue;

    const idx = sessionOrder.get(m.sessionId);
    if (idx === undefined) continue;

    const roundNumber = Math.floor(idx / roundSize) + 1; // 1-based

    if (!map.has(roundNumber)) {
      map.set(roundNumber, { wins: 0, losses: 0, ties: 0, sessionIndices: [] });
    }
    const rec = map.get(roundNumber)!;
    if (outcome === "win") rec.wins++;
    else if (outcome === "loss") rec.losses++;
    else rec.ties++;
    if (!rec.sessionIndices.includes(idx)) rec.sessionIndices.push(idx);
  }

  // Build result with start/end dates derived from session indices within each round
  const results: RoundRecord[] = [];

  for (const [round, rec] of map) {
    // The round spans session indices [(round-1)*roundSize .. round*roundSize - 1]
    const firstIdx = (round - 1) * roundSize;
    const lastIdx = round * roundSize - 1;

    // Find dates for the boundary sessions
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    for (const [sid, idx] of sessionOrder) {
      if (idx === firstIdx) startDate = sessionDates.get(sid);
      if (idx === lastIdx) endDate = sessionDates.get(sid);
    }

    // Fallback: use the actual sessions seen in this round
    if (!startDate || !endDate) {
      const sortedIndices = [...rec.sessionIndices].sort((a, b) => a - b);
      for (const [sid, idx] of sessionOrder) {
        if (idx === sortedIndices[0]) startDate = sessionDates.get(sid);
        if (idx === sortedIndices[sortedIndices.length - 1]) endDate = sessionDates.get(sid);
      }
    }

    if (!startDate || !endDate) continue;

    results.push({ round, startDate, endDate, wins: rec.wins, losses: rec.losses, ties: rec.ties });
  }

  return results.sort((a, b) => a.round - b.round);
}

/**
 * Returns top N teammates by shared wins, with total matches together.
 * Only includes players who appeared on the same team at least once.
 */
export function computeTeammateAffinity(
  playerId: string,
  matches: MatchRecord[],
  topN = 5,
): TeammateAffinity[] {
  const sharedWins = new Map<string, number>();
  const totalTogether = new Map<string, number>();

  for (const m of matches) {
    const inA = m.teamAPlayerIds.includes(playerId);
    const inB = m.teamBPlayerIds.includes(playerId);
    if (!inA && !inB) continue;

    const teammates = inA ? m.teamAPlayerIds : m.teamBPlayerIds;
    const outcome = outcomeFor(playerId, m);

    for (const id of teammates) {
      if (id === playerId) continue;
      totalTogether.set(id, (totalTogether.get(id) ?? 0) + 1);
      if (outcome === "win") {
        sharedWins.set(id, (sharedWins.get(id) ?? 0) + 1);
      }
    }
  }

  return Array.from(totalTogether.keys())
    .map((id) => ({
      teammateId: id,
      sharedWins: sharedWins.get(id) ?? 0,
      totalMatchesTogether: totalTogether.get(id)!,
    }))
    .sort((a, b) => {
      if (b.sharedWins !== a.sharedWins) return b.sharedWins - a.sharedWins;
      return b.totalMatchesTogether - a.totalMatchesTogether;
    })
    .slice(0, topN);
}
