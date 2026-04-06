import { describe, it, expect } from "vitest";
import { generateTeamOptions, type PlayerInput } from "./team-balance";

function makePlayers(ranks: number[]): PlayerInput[] {
  return ranks.map((rank, i) => ({
    id: `p${i}`,
    displayName: `Player ${i}`,
    rank,
    positions: [],
  }));
}

describe("generateTeamOptions", () => {
  it("returns empty array for fewer than 3 players", () => {
    expect(generateTeamOptions([])).toEqual([]);
    expect(generateTeamOptions(makePlayers([50]))).toEqual([]);
    expect(generateTeamOptions(makePlayers([50, 60]))).toEqual([]);
  });

  it("returns 3 options for exactly 3 players", () => {
    const opts = generateTeamOptions(makePlayers([80, 60, 40]));
    expect(opts).toHaveLength(3);
    opts.forEach((opt) => {
      expect(opt.teams).toHaveLength(3);
      // Each team has 1 player
      const total = opt.teams.reduce((s, t) => s + t.players.length, 0);
      expect(total).toBe(3);
    });
  });

  it("splits 15 players into 3 teams of 5", () => {
    const players = makePlayers(Array.from({ length: 15 }, (_, i) => 100 - i * 5));
    const opts = generateTeamOptions(players);
    expect(opts).toHaveLength(3);
    opts.forEach((opt) => {
      opt.teams.forEach((team) => expect(team.players).toHaveLength(5));
    });
  });

  it("splits 12 players into 3 teams of 4", () => {
    const players = makePlayers(Array.from({ length: 12 }, (_, i) => 90 - i * 5));
    const opts = generateTeamOptions(players);
    opts.forEach((opt) => {
      opt.teams.forEach((team) => expect(team.players).toHaveLength(4));
    });
  });

  it("splits 9 players into 3 teams of 3", () => {
    const players = makePlayers(Array.from({ length: 9 }, (_, i) => 70 - i * 5));
    const opts = generateTeamOptions(players);
    opts.forEach((opt) => {
      opt.teams.forEach((team) => expect(team.players).toHaveLength(3));
    });
  });

  it("handles 14 players: last team gets one fewer (5,5,4)", () => {
    const players = makePlayers(Array.from({ length: 14 }, (_, i) => 90 - i * 5));
    const opts = generateTeamOptions(players);
    opts.forEach((opt) => {
      const sizes = opt.teams.map((t) => t.players.length).sort((a, b) => a - b);
      expect(sizes).toEqual([4, 5, 5]);
    });
  });

  it("computes rankSum correctly", () => {
    const players = makePlayers([100, 80, 60]);
    const opts = generateTeamOptions(players);
    opts.forEach((opt) => {
      opt.teams.forEach((team) => {
        const expected = team.players.reduce((s, p) => s + p.rank, 0);
        expect(team.rankSum).toBe(expected);
      });
    });
  });

  it("all players appear exactly once per option", () => {
    const players = makePlayers(Array.from({ length: 15 }, (_, i) => 100 - i * 5));
    const ids = players.map((p) => p.id);
    const opts = generateTeamOptions(players);
    opts.forEach((opt) => {
      const assigned = opt.teams.flatMap((t) => t.players.map((p) => p.id));
      expect(assigned.sort()).toEqual(ids.sort());
    });
  });

  it("snake draft produces balanced rank sums for 15 even-ranked players", () => {
    // Ranks: 15,14,...,1 — snake draft should be very balanced
    const players = makePlayers(Array.from({ length: 15 }, (_, i) => 15 - i));
    const [opt1] = generateTeamOptions(players);
    const sums = opt1.teams.map((t) => t.rankSum);
    const max = Math.max(...sums);
    const min = Math.min(...sums);
    // With 15 players of ranks 1-15, each team should get close to sum 40 (120/3)
    expect(max - min).toBeLessThanOrEqual(3);
  });

  it("3 options produce different player assignments for large groups", () => {
    const players = makePlayers(Array.from({ length: 15 }, (_, i) => 100 - i * 3));
    const [opt1, opt2, opt3] = generateTeamOptions(players);
    // At least two options should differ in team A composition
    const ids1 = opt1.teams[0].players.map((p) => p.id).sort().join(",");
    const ids2 = opt2.teams[0].players.map((p) => p.id).sort().join(",");
    const ids3 = opt3.teams[0].players.map((p) => p.id).sort().join(",");
    // Not all three identical
    expect(new Set([ids1, ids2, ids3]).size).toBeGreaterThan(1);
  });
});
