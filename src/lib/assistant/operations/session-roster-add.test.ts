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
      create: vi.fn(),
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
import { assistantRosterAdd } from "./session-roster-add";
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
    maxPlayers: 14,
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

describe("assistantRosterAdd", () => {
  beforeEach(() => {
    vi.mocked(prisma.gameSession.findFirst).mockReset();
    vi.mocked(prisma.gameSession.findUnique).mockReset();
    vi.mocked(prisma.player.findUnique).mockReset();
    vi.mocked(prisma.attendance.create).mockReset();
    vi.mocked(writeAuditLog).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockImplementation(async (attendances) => attendances);
  });

  it("throws SESSION_NOT_FOUND when no upcoming session exists", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(null);
    await expect(assistantRosterAdd({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
      status: 404,
    });
  });

  it("throws SESSION_CLOSED when next session is closed", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ isClosed: true }) as never);
    await expect(assistantRosterAdd({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "SESSION_CLOSED",
      status: 409,
    });
  });

  it("throws PLAYER_NOT_FOUND for an unknown phone", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    await expect(assistantRosterAdd({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "PLAYER_NOT_FOUND",
      status: 404,
    });
  });

  it("adds a player in a confirmed slot and returns correct data", async () => {
    const player = makePlayer();
    const existingAtt = makeAttendance("p0");
    const newAtt = makeAttendance("p1", player);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ maxPlayers: 14 }) as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.attendance.create).mockResolvedValue({ id: "new-att-id" } as never);
    vi.mocked(prisma.gameSession.findUnique).mockResolvedValue(
      makeSession({ maxPlayers: 14, attendances: [existingAtt, newAtt] }) as never,
    );

    const result = await assistantRosterAdd({ player_phone: "0507654321" }, adminActor);

    expect(result.status).toBe("confirmed");
    expect(result.position).toBe(2);
    expect(result.confirmed_count).toBe(2);
    expect(result.waitlisted_count).toBe(0);
    expect(result.player.display_name).toBe("יוסי");
    expect(result.player.phone).toBe("0507654321");
    expect(result.session_id).toBe("s1");
  });

  it("adds a player beyond maxPlayers and returns waitlisted status", async () => {
    const player = makePlayer({ id: "p2" });
    const atts = Array.from({ length: 2 }, (_, i) => makeAttendance(`p${i}`));
    const newAtt = makeAttendance("p2", player);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ maxPlayers: 2 }) as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.attendance.create).mockResolvedValue({ id: "new-att-id" } as never);
    vi.mocked(prisma.gameSession.findUnique).mockResolvedValue(
      makeSession({ maxPlayers: 2, attendances: [...atts, newAtt] }) as never,
    );

    const result = await assistantRosterAdd({ player_phone: "0507654321" }, adminActor);

    expect(result.status).toBe("waitlisted");
    expect(result.position).toBe(3);
    expect(result.confirmed_count).toBe(2);
    expect(result.waitlisted_count).toBe(1);
  });

  it("throws ALREADY_REGISTERED on P2002 from attendance create", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(makePlayer() as never);
    vi.mocked(prisma.attendance.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: {},
        batchRequestIdx: undefined,
      }),
    );

    await expect(assistantRosterAdd({ player_phone: "0507654321" }, adminActor)).rejects.toMatchObject({
      code: "ALREADY_REGISTERED",
      status: 409,
    });
  });

  it("calls writeAuditLog with correct params after successful add", async () => {
    const player = makePlayer();
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.attendance.create).mockResolvedValue({ id: "new-att-id" } as never);
    vi.mocked(prisma.gameSession.findUnique).mockResolvedValue(
      makeSession({ attendances: [makeAttendance("p1", player)] }) as never,
    );

    await assistantRosterAdd({ player_phone: "0507654321" }, adminActor);

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin-player-id",
        action: "ASSISTANT_ROSTER_ADD",
        entityType: "Attendance",
        entityId: "new-att-id",
      }),
    );
  });

  it("rejects unknown params with a ZodError", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    await expect(assistantRosterAdd({ player_phone: "0507654321", extra: true }, adminActor)).rejects.toThrow();
  });
});
