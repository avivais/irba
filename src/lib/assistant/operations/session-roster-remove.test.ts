import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gameSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    attendance: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sort-attendances", () => ({
  sortAttendancesByPrecedence: vi.fn(async (attendances) => attendances),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sortAttendancesByPrecedence } from "@/lib/sort-attendances";
import { writeAuditLog } from "@/lib/audit";
import { assistantRosterRemove } from "./session-roster-remove";
import type { AssistantActor } from "../types";

const adminActor: AssistantActor = {
  level: "admin",
  normalizedPhone: "0501234567",
  player: { id: "admin-player-id", phone: "0501234567", nickname: null, firstNameHe: null, lastNameHe: null, isAdmin: true },
};

function makeSession(overrides = {}) {
  return {
    id: "s1",
    date: new Date("2026-05-29T18:00:00.000Z"),
    maxPlayers: 2,
    isClosed: false,
    isArchived: false,
    cancelledAt: null,
    attendances: [],
    ...overrides,
  };
}

function makePlayer(overrides = {}) {
  return {
    id: "p1",
    phone: "0507654321",
    nickname: "יוסי",
    firstNameHe: null,
    lastNameHe: null,
    firstNameEn: null,
    lastNameEn: null,
    playerKind: "REGISTERED",
    isAdmin: false,
    ...overrides,
  };
}

function makeAttendance(playerId: string, player = makePlayer({ id: playerId })) {
  return {
    id: `att-${playerId}`,
    playerId,
    gameSessionId: "s1",
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    player,
  };
}

describe("assistantRosterRemove", () => {
  beforeEach(() => {
    vi.mocked(prisma.gameSession.findFirst).mockReset();
    vi.mocked(prisma.gameSession.findUnique).mockReset();
    vi.mocked(prisma.player.findUnique).mockReset();
    vi.mocked(prisma.attendance.findFirst).mockReset();
    vi.mocked(prisma.attendance.delete).mockReset();
    vi.mocked(writeAuditLog).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockImplementation(async (attendances) => attendances);
  });

  it("throws SESSION_NOT_FOUND when no upcoming session exists", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(null);
    await expect(assistantRosterRemove({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
      status: 404,
    });
  });

  it("throws SESSION_CLOSED when next session is closed", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ isClosed: true }) as never);
    await expect(assistantRosterRemove({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "SESSION_CLOSED",
      status: 409,
    });
  });

  it("throws PLAYER_NOT_FOUND for an unknown phone", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    await expect(assistantRosterRemove({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "PLAYER_NOT_FOUND",
      status: 404,
    });
  });

  it("throws NOT_REGISTERED when player has no attendance row", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(makePlayer() as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue(null);
    await expect(assistantRosterRemove({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "NOT_REGISTERED",
      status: 409,
    });
  });

  it("removes a confirmed player with no waitlist and returns was_confirmed:true, promoted_player:null", async () => {
    const player = makePlayer();
    const att = makeAttendance("p1", player);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ maxPlayers: 2 }) as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce(makeSession({ maxPlayers: 2, attendances: [att] }) as never) // pre-delete
      .mockResolvedValueOnce(makeSession({ maxPlayers: 2, attendances: [] }) as never); // post-delete
    vi.mocked(prisma.attendance.delete).mockResolvedValue({} as never);

    const result = await assistantRosterRemove({ player_phone: "0507654321" }, adminActor);

    expect(result.was_confirmed).toBe(true);
    expect(result.promoted_player).toBeNull();
    expect(result.confirmed_count).toBe(0);
    expect(result.waitlisted_count).toBe(0);
  });

  it("removes a confirmed player with waitlist and populates promoted_player", async () => {
    const confirmedPlayer = makePlayer({ id: "p1", phone: "0507654321", nickname: "יוסי" });
    const waitlistedPlayer = makePlayer({ id: "p2", phone: "0509999999", nickname: "דני" });
    const att1 = makeAttendance("p1", confirmedPlayer);
    const att2 = makeAttendance("p2", waitlistedPlayer);

    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ maxPlayers: 1 }) as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(confirmedPlayer as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce(makeSession({ maxPlayers: 1, attendances: [att1, att2] }) as never) // pre-delete
      .mockResolvedValueOnce(makeSession({ maxPlayers: 1, attendances: [att2] }) as never); // post-delete
    vi.mocked(prisma.attendance.delete).mockResolvedValue({} as never);

    const result = await assistantRosterRemove({ player_phone: "0507654321" }, adminActor);

    expect(result.was_confirmed).toBe(true);
    expect(result.promoted_player).toEqual({ display_name: "דני", phone: "0509999999" });
    expect(result.confirmed_count).toBe(1);
    expect(result.waitlisted_count).toBe(0);
  });

  it("removes a waitlisted player and returns was_confirmed:false, promoted_player:null", async () => {
    const confirmedPlayer = makePlayer({ id: "p1", nickname: "first" });
    const waitlistedPlayer = makePlayer({ id: "p2", phone: "0507654321", nickname: "waitlisted" });
    const att1 = makeAttendance("p1", confirmedPlayer);
    const att2 = makeAttendance("p2", waitlistedPlayer);

    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ maxPlayers: 1 }) as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(waitlistedPlayer as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p2" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce(makeSession({ maxPlayers: 1, attendances: [att1, att2] }) as never)
      .mockResolvedValueOnce(makeSession({ maxPlayers: 1, attendances: [att1] }) as never);
    vi.mocked(prisma.attendance.delete).mockResolvedValue({} as never);

    const result = await assistantRosterRemove({ player_phone: "0507654321" }, adminActor);

    expect(result.was_confirmed).toBe(false);
    expect(result.promoted_player).toBeNull();
  });

  it("treats P2025 (race: already gone) as success", async () => {
    const player = makePlayer();
    const att = makeAttendance("p1", player);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce(makeSession({ attendances: [att] }) as never)
      .mockResolvedValueOnce(makeSession({ attendances: [] }) as never);
    vi.mocked(prisma.attendance.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "5.0.0",
        meta: {},
        batchRequestIdx: undefined,
      }),
    );

    await expect(assistantRosterRemove({ player_phone: "0507654321" }, adminActor)).resolves.toBeDefined();
  });

  it("calls writeAuditLog with correct params on successful remove", async () => {
    const player = makePlayer();
    const att = makeAttendance("p1", player);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce(makeSession({ attendances: [att] }) as never)
      .mockResolvedValueOnce(makeSession({ attendances: [] }) as never);
    vi.mocked(prisma.attendance.delete).mockResolvedValue({} as never);

    await assistantRosterRemove({ player_phone: "0507654321" }, adminActor);

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin-player-id",
        action: "ASSISTANT_ROSTER_REMOVE",
        entityType: "Attendance",
        entityId: "att-p1",
      }),
    );
  });
});
