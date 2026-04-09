import { describe, it, expect } from "vitest";
import {
  computeBlendedRank,
  normalizePeerScore,
  normalizeWinScore,
  type RankComponentInput,
  type RankWeights,
} from "./computed-rank-pure";

const equalWeights: RankWeights = {
  adminWeight: 1,
  peerWeight: 1,
  winWeight: 1,
};

function makeInput(overrides: Partial<RankComponentInput>): RankComponentInput {
  return {
    playerId: "p1",
    playerKind: "REGISTERED",
    adminRank: 60,
    peerScore: null,
    winScore: null,
    defaultRank: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizePeerScore
// ---------------------------------------------------------------------------

describe("normalizePeerScore", () => {
  it("position 1 of N returns 100", () => {
    expect(normalizePeerScore(1, 10)).toBe(100);
  });

  it("position N of N returns 0", () => {
    expect(normalizePeerScore(10, 10)).toBe(0);
  });

  it("middle position returns 50 for odd N", () => {
    // N=3: position 2 → (1 - 1/2)*100 = 50
    expect(normalizePeerScore(2, 3)).toBe(50);
  });

  it("N=1 returns 100 regardless of position", () => {
    expect(normalizePeerScore(1, 1)).toBe(100);
  });

  it("fractional average position is handled correctly", () => {
    // avg position 1.5, N=4 → (1 - 0.5/3) * 100 ≈ 83.33
    expect(normalizePeerScore(1.5, 4)).toBeCloseTo(83.33, 1);
  });
});

// ---------------------------------------------------------------------------
// normalizeWinScore
// ---------------------------------------------------------------------------

describe("normalizeWinScore", () => {
  it("win ratio 0 → 0", () => {
    expect(normalizeWinScore(0)).toBe(0);
  });

  it("win ratio 1 → 100", () => {
    expect(normalizeWinScore(1)).toBe(100);
  });

  it("win ratio 0.5 → 50", () => {
    expect(normalizeWinScore(0.5)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeBlendedRank
// ---------------------------------------------------------------------------

describe("computeBlendedRank", () => {
  it("only admin rank when peer and win are null", () => {
    const input = makeInput({ adminRank: 70, peerScore: null, winScore: null });
    const weights: RankWeights = { adminWeight: 1, peerWeight: 1, winWeight: 1 };
    // totalW = 1 (only adminWeight applies)
    expect(computeBlendedRank(input, weights)).toBe(70);
  });

  it("uses defaultRank when adminRank is null", () => {
    const input = makeInput({ adminRank: null, peerScore: null, winScore: null, defaultRank: 50 });
    const weights: RankWeights = { adminWeight: 1, peerWeight: 0, winWeight: 0 };
    expect(computeBlendedRank(input, weights)).toBe(50);
  });

  it("all three components, equal weights", () => {
    const input = makeInput({ adminRank: 60, peerScore: 90, winScore: 30 });
    // (60 + 90 + 30) / 3 = 60
    expect(computeBlendedRank(input, equalWeights)).toBe(60);
  });

  it("DROP_IN ignores peer and win components", () => {
    const input = makeInput({
      playerKind: "DROP_IN",
      adminRank: 80,
      peerScore: 100,
      winScore: 100,
    });
    // Only admin weight applies even though peerScore and winScore are set
    expect(computeBlendedRank(input, equalWeights)).toBe(80);
  });

  it("REGISTERED below win threshold: winScore null → win weight excluded", () => {
    const input = makeInput({ adminRank: 60, peerScore: 80, winScore: null });
    // totalW = 1 + 1 = 2; (60 + 80) / 2 = 70
    expect(computeBlendedRank(input, equalWeights)).toBe(70);
  });

  it("returns null when all effective weights are zero", () => {
    const input = makeInput({ adminRank: 60, peerScore: null, winScore: null });
    const weights: RankWeights = { adminWeight: 0, peerWeight: 0, winWeight: 0 };
    expect(computeBlendedRank(input, weights)).toBeNull();
  });

  it("respects custom weight ratios", () => {
    const input = makeInput({ adminRank: 100, peerScore: 0, winScore: null });
    const weights: RankWeights = { adminWeight: 3, peerWeight: 1, winWeight: 0 };
    // (3*100 + 1*0) / 4 = 75
    expect(computeBlendedRank(input, weights)).toBe(75);
  });

  it("admin weight 0: only peer and win count", () => {
    const input = makeInput({ adminRank: 100, peerScore: 40, winScore: 60 });
    const weights: RankWeights = { adminWeight: 0, peerWeight: 1, winWeight: 1 };
    // (0*100 + 1*40 + 1*60) / 2 = 50
    expect(computeBlendedRank(input, weights)).toBe(50);
  });

  it("handles edge: all scores at 0", () => {
    const input = makeInput({ adminRank: 0, peerScore: 0, winScore: 0 });
    expect(computeBlendedRank(input, equalWeights)).toBe(0);
  });

  it("handles edge: all scores at 100", () => {
    const input = makeInput({ adminRank: 100, peerScore: 100, winScore: 100 });
    expect(computeBlendedRank(input, equalWeights)).toBe(100);
  });
});
