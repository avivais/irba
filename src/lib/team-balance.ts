export type PlayerInput = {
  id: string;
  displayName: string;
  rank: number;
  positions: string[];
};

export type Team = {
  players: PlayerInput[];
  rankSum: number;
  positionAssignment: Record<string, string | null>;
};

export type TeamOption = {
  teams: [Team, Team, Team];
};

export const ALL_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

// How many of the top remaining players to scan for a position-filling match.
// Skipping at most LOOKAHEAD-1 higher-ranked players bounds the rank-balance impact.
const LOOKAHEAD = 5;

/**
 * Backtracking position assignment: given a team, assign one position per
 * player (from their eligible positions) maximising total assigned slots.
 * With ≤8 players and 5 positions the search space is tiny.
 */
function assignPositions(players: PlayerInput[]): Record<string, string | null> {
  const n = players.length;
  const best: (string | null)[] = Array(n).fill(null);
  let bestCount = 0;
  const current: (string | null)[] = Array(n).fill(null);

  function bt(i: number, used: Set<string>, count: number): void {
    if (i === n) {
      if (count > bestCount) {
        bestCount = count;
        for (let j = 0; j < n; j++) best[j] = current[j];
      }
      return;
    }
    for (const pos of players[i].positions) {
      if (!used.has(pos)) {
        current[i] = pos;
        used.add(pos);
        bt(i + 1, used, count + 1);
        used.delete(pos);
      }
    }
    // Also try assigning no position (null)
    current[i] = null;
    bt(i + 1, used, count);
  }

  bt(0, new Set(), 0);

  const result: Record<string, string | null> = {};
  for (let i = 0; i < n; i++) {
    result[players[i].id] = best[i];
  }
  return result;
}

/**
 * Build a Team from a player array, computing rank sum and position assignment.
 */
function makeTeam(players: PlayerInput[]): Team {
  return {
    players,
    rankSum: players.reduce((s, p) => s + p.rank, 0),
    positionAssignment: assignPositions(players),
  };
}

/**
 * Position-aware snake draft.
 *
 * Uses the standard A B C C B A snake order but at each pick prefers the
 * highest-ranked player (within the top LOOKAHEAD remaining) who fills an
 * unfilled position for the current team. Falls back to the highest-ranked
 * remaining player when no position match is found or all positions are filled.
 *
 * The bounded lookahead limits rank-balance impact: we skip at most
 * LOOKAHEAD-1 higher-ranked players to satisfy a position constraint.
 */
function positionAwareSnakeDraft(
  players: PlayerInput[]
): [PlayerInput[], PlayerInput[], PlayerInput[]] {
  const teams: [PlayerInput[], PlayerInput[], PlayerInput[]] = [[], [], []];
  const needs: [Set<string>, Set<string>, Set<string>] = [
    new Set<string>(ALL_POSITIONS),
    new Set<string>(ALL_POSITIONS),
    new Set<string>(ALL_POSITIONS),
  ];
  const order = [0, 1, 2, 2, 1, 0] as const;
  const remaining = [...players]; // caller guarantees rank-descending order

  for (let i = 0; i < players.length; i++) {
    const t = order[i % 6];
    const teamNeeds = needs[t];

    let chosenIdx = 0; // default: highest-ranked remaining
    if (teamNeeds.size > 0) {
      const top = Math.min(LOOKAHEAD, remaining.length);
      for (let j = 0; j < top; j++) {
        if (remaining[j].positions.some((p) => teamNeeds.has(p))) {
          chosenIdx = j;
          break;
        }
      }
    }

    const [player] = remaining.splice(chosenIdx, 1);
    teams[t].push(player);

    // Mark the first matching need as filled
    for (const pos of player.positions) {
      if (teamNeeds.has(pos)) {
        teamNeeds.delete(pos);
        break;
      }
    }
  }

  return teams;
}

/**
 * Rotate array: move first `n` elements to the end.
 */
function rotate<T>(arr: T[], n: number): T[] {
  const pos = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(pos), ...arr.slice(0, pos)];
}

/**
 * Split players into 3 equal-ish tiers by rank (for shuffling within tiers).
 */
function splitIntoTiers(sorted: PlayerInput[]): [PlayerInput[], PlayerInput[], PlayerInput[]] {
  const n = sorted.length;
  const t1 = Math.ceil(n / 3);
  const t2 = Math.ceil((n - t1) / 2);
  return [sorted.slice(0, t1), sorted.slice(t1, t1 + t2), sorted.slice(t1 + t2)];
}

/**
 * Deterministic Fisher-Yates shuffle using a simple LCG seeded by seed.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Generate 3 distinct balanced team splits from a list of players.
 *
 * Option 1: seed-based rotation of the sorted list, then position-aware snake draft
 * Option 2: shuffle within rank tiers (top/mid/bottom thirds), then position-aware snake draft
 * Option 3: rotate the sorted list by 1 before tier-shuffle + position-aware snake draft
 *
 * All 3 options vary with the seed so every re-shuffle produces different teams.
 * Returns an empty array when there are fewer than 3 players.
 */
export function generateTeamOptions(players: PlayerInput[], seed = 0): TeamOption[] {
  if (players.length < 3) return [];

  const sorted = [...players].sort((a, b) => b.rank - a.rank);

  // Option 1: rotate by seed-derived offset, then position-aware snake draft
  const rot1 = rotate(sorted, seed % Math.max(1, sorted.length));
  const [a1, b1, c1] = positionAwareSnakeDraft(rot1);
  const opt1: TeamOption = { teams: [makeTeam(a1), makeTeam(b1), makeTeam(c1)] };

  // Option 2: shuffle within tiers, then position-aware snake draft
  const [t1, t2, t3] = splitIntoTiers(sorted);
  const shuffled2 = [
    ...seededShuffle(t1, seed ^ 0x2a),
    ...seededShuffle(t2, seed ^ 0x89),
    ...seededShuffle(t3, seed ^ 0x3e7),
  ];
  const [a2, b2, c2] = positionAwareSnakeDraft(shuffled2);
  const opt2: TeamOption = { teams: [makeTeam(a2), makeTeam(b2), makeTeam(c2)] };

  // Option 3: rotate sorted list by 1, shuffle tiers with different seeds, then position-aware snake
  const rotated = rotate(sorted, 1);
  const [r1, r2, r3] = splitIntoTiers(rotated);
  const shuffled3 = [
    ...seededShuffle(r1, seed ^ 0x07),
    ...seededShuffle(r2, seed ^ 0x13a),
    ...seededShuffle(r3, seed ^ 0x13ba),
  ];
  const [a3, b3, c3] = positionAwareSnakeDraft(shuffled3);
  const opt3: TeamOption = { teams: [makeTeam(a3), makeTeam(b3), makeTeam(c3)] };

  // Filter to options where every full-size team (≥5 players) covers all 5 positions.
  // Skip filtering when no players have position data (graceful degradation).
  const hasPositionData = players.some((p) => p.positions.length > 0);
  if (!hasPositionData) return [opt1, opt2, opt3];

  return [opt1, opt2, opt3].filter((opt) =>
    opt.teams.every((team) => {
      if (team.players.length < ALL_POSITIONS.length) return true; // small team, can't fill all slots
      const assigned = new Set(Object.values(team.positionAssignment).filter(Boolean));
      return ALL_POSITIONS.every((pos) => assigned.has(pos));
    })
  );
}
