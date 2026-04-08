export type PlayerInput = {
  id: string;
  displayName: string;
  rank: number;
  positions: string[];
};

export type Team = {
  players: PlayerInput[];
  rankSum: number;
};

export type TeamOption = {
  teams: [Team, Team, Team];
};

/**
 * Build a Team from a player array.
 */
function makeTeam(players: PlayerInput[]): Team {
  return { players, rankSum: players.reduce((s, p) => s + p.rank, 0) };
}

/**
 * Snake-draft assignment: distributes players in rank order across 3 teams.
 * Pattern: A B C C B A A B C …
 * Each "round" of 6 assigns 2 to each team, minimising rank-sum variance.
 */
function snakeDraft(sorted: PlayerInput[]): [PlayerInput[], PlayerInput[], PlayerInput[]] {
  const a: PlayerInput[] = [];
  const b: PlayerInput[] = [];
  const c: PlayerInput[] = [];
  // Snake order for each position within a 6-player cycle: A B C C B A
  const order = [0, 1, 2, 2, 1, 0] as const;
  const buckets = [a, b, c];
  sorted.forEach((p, i) => {
    buckets[order[i % 6]].push(p);
  });
  return [a, b, c];
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
 * Option 1: pure rank-descending snake draft
 * Option 2: shuffle within rank tiers (top/mid/bottom thirds), then snake draft
 * Option 3: rotate the sorted list by 1 before tier-shuffle + snake draft
 *
 * Returns an empty array when there are fewer than 3 players.
 */
export function generateTeamOptions(players: PlayerInput[], seed = 0): TeamOption[] {
  if (players.length < 3) return [];

  const sorted = [...players].sort((a, b) => b.rank - a.rank);

  // Option 1: pure snake draft
  const [a1, b1, c1] = snakeDraft(sorted);
  const opt1: TeamOption = { teams: [makeTeam(a1), makeTeam(b1), makeTeam(c1)] };

  // Option 2: shuffle within tiers, then snake draft
  const [t1, t2, t3] = splitIntoTiers(sorted);
  const shuffled2 = [
    ...seededShuffle(t1, seed ^ 0x2a),
    ...seededShuffle(t2, seed ^ 0x89),
    ...seededShuffle(t3, seed ^ 0x3e7),
  ];
  const [a2, b2, c2] = snakeDraft(shuffled2);
  const opt2: TeamOption = { teams: [makeTeam(a2), makeTeam(b2), makeTeam(c2)] };

  // Option 3: rotate sorted list by 1, shuffle tiers with different seeds, then snake
  const rotated = rotate(sorted, 1);
  const [r1, r2, r3] = splitIntoTiers(rotated);
  const shuffled3 = [
    ...seededShuffle(r1, seed ^ 0x07),
    ...seededShuffle(r2, seed ^ 0x13a),
    ...seededShuffle(r3, seed ^ 0x13ba),
  ];
  const [a3, b3, c3] = snakeDraft(shuffled3);
  const opt3: TeamOption = { teams: [makeTeam(a3), makeTeam(b3), makeTeam(c3)] };

  return [opt1, opt2, opt3];
}
