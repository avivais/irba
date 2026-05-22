import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gameSession: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sort-attendances", () => ({
  sortAttendancesByPrecedence: vi.fn(async (attendances) => attendances),
}));

import { prisma } from "@/lib/prisma";
import { sortAttendancesByPrecedence } from "@/lib/sort-attendances";
import { getAssistantSessionStatus, getSafeAssistantDisplayName } from "./session-status";

const now = new Date("2026-05-22T09:00:00.000Z");

function player(overrides = {}) {
  return {
    id: "p1",
    phone: "0500000000",
    playerKind: "REGISTERED",
    positions: [],
    rank: null,
    isAdmin: false,
    nickname: null,
    firstNameHe: null,
    lastNameHe: null,
    firstNameEn: null,
    lastNameEn: null,
    birthdate: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    email: null,
    nationalId: null,
    passwordHash: null,
    otpCode: null,
    otpExpiresAt: null,
    emailVerified: false,
    regulationsAcceptedAt: null,
    regulationsAcceptedVersion: null,
    computedRank: null,
    ...overrides,
  };
}

function attendance(index: number, playerOverrides = {}) {
  return {
    id: `a${index}`,
    playerId: `p${index}`,
    gameSessionId: "s1",
    createdAt: new Date(`2026-05-20T10:00:0${index}.000Z`),
    player: player({ id: `p${index}`, ...playerOverrides }),
  };
}

function session(overrides = {}) {
  return {
    id: "s1",
    date: new Date("2026-05-23T17:00:00.000Z"),
    maxPlayers: 2,
    isClosed: false,
    isArchived: false,
    isCharged: false,
    alertEarlyFiredAt: null,
    alertCriticalFiredAt: null,
    cancelledAt: null,
    cancellationReason: null,
    durationMinutes: 90,
    locationName: "אילן רמון",
    locationLat: 32.1,
    locationLng: 34.8,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    attendances: [],
    ...overrides,
  };
}

describe("getAssistantSessionStatus", () => {
  beforeEach(() => {
    vi.mocked(prisma.gameSession.findFirst).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockImplementation(async (attendances) => attendances);
  });

  it("returns an empty status when no upcoming active session exists", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(null);

    const result = await getAssistantSessionStatus({}, now);

    expect(result).toEqual({
      session: null,
      counts: { registered: 0, confirmed: 0, waitlisted: 0, spots_left: 0 },
      confirmed: [],
      waitlist: [],
    });
  });

  it("queries the next non-archived non-cancelled session", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(session() as never);

    await getAssistantSessionStatus({}, now);

    expect(prisma.gameSession.findFirst).toHaveBeenCalledWith({
      where: { date: { gte: now }, isArchived: false, cancelledAt: null },
      orderBy: { date: "asc" },
      include: { attendances: { include: { player: true } } },
    });
  });

  it("splits confirmed and waitlist by maxPlayers after existing sorting", async () => {
    const attendances = [
      attendance(1, { nickname: "אבי" }),
      attendance(2, { firstNameHe: "מיקי", lastNameHe: "בוט" }),
      attendance(3, { firstNameEn: "Drop", lastNameEn: "In", playerKind: "DROP_IN" }),
    ];
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(session({ attendances }) as never);
    vi.mocked(sortAttendancesByPrecedence).mockResolvedValue([attendances[1], attendances[0], attendances[2]] as never);

    const result = await getAssistantSessionStatus({}, now);

    expect(result.counts).toEqual({ registered: 3, confirmed: 2, waitlisted: 1, spots_left: 0 });
    expect(result.confirmed).toEqual([
      { position: 1, player_id: "p2", display_name: "מיקי בוט", player_kind: "REGISTERED" },
      { position: 2, player_id: "p1", display_name: "אבי", player_kind: "REGISTERED" },
    ]);
    expect(result.waitlist).toEqual([
      { position: 1, player_id: "p3", display_name: "Drop In", player_kind: "DROP_IN" },
    ]);
  });

  it("honors include flags while keeping counts", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(
      session({ attendances: [attendance(1, { nickname: "אבי" }), attendance(2, { nickname: "מיקי" })] }) as never,
    );

    const result = await getAssistantSessionStatus({ include_registered_list: false, include_waitlist: false }, now);

    expect(result.counts).toEqual({ registered: 2, confirmed: 2, waitlisted: 0, spots_left: 0 });
    expect(result.confirmed).toEqual([]);
    expect(result.waitlist).toEqual([]);
  });

  it("keeps spots_left at zero when over capacity", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(
      session({ maxPlayers: 1, attendances: [attendance(1), attendance(2)] }) as never,
    );

    const result = await getAssistantSessionStatus({}, now);

    expect(result.counts.spots_left).toBe(0);
  });

  it("rejects unknown params", async () => {
    await expect(getAssistantSessionStatus({ session_id: "s1" }, now)).rejects.toThrow();
  });
});

describe("getSafeAssistantDisplayName", () => {
  it("prefers nickname, then Hebrew, then stored name, then English, then safe fallback", () => {
    expect(getSafeAssistantDisplayName({ nickname: "ניק", firstNameHe: "שם" })).toBe("ניק");
    expect(getSafeAssistantDisplayName({ firstNameHe: "שם", lastNameHe: "עברית" })).toBe("שם עברית");
    expect(getSafeAssistantDisplayName({ name: "Stored Name", firstNameEn: "English" })).toBe("Stored Name");
    expect(getSafeAssistantDisplayName({ firstNameEn: "English", lastNameEn: "Name" })).toBe("English Name");
    expect(getSafeAssistantDisplayName({})).toBe("שחקן");
  });
});
