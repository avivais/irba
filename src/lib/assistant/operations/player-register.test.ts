import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appConfig: { findUnique: vi.fn() },
    gameSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    attendance: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
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
import {
  assistantPlayerRegisterAdd,
  assistantPlayerRegisterCancel,
  assistantPlayerRegisterStatus,
} from "./player-register";
import type { AssistantActor } from "../types";

const memberActor: AssistantActor = {
  level: "member",
  normalizedPhone: "0507654321",
  player: { id: "p1", phone: "0507654321", nickname: "יוסי", firstNameHe: null, lastNameHe: null, isAdmin: false },
};

const guestActor: AssistantActor = { level: "guest", normalizedPhone: "0500000000", player: null };

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

describe("assistant self-service player register operations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T10:00:00.000Z"));
    vi.mocked(prisma.appConfig.findUnique).mockReset();
    vi.mocked(prisma.gameSession.findFirst).mockReset();
    vi.mocked(prisma.gameSession.findUnique).mockReset();
    vi.mocked(prisma.attendance.create).mockReset();
    vi.mocked(prisma.attendance.findFirst).mockReset();
    vi.mocked(prisma.attendance.delete).mockReset();
    vi.mocked(writeAuditLog).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockImplementation(async (attendances) => attendances);
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      key: "rsvp_close_hours",
      value: "13",
      updatedAt: new Date(),
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows a known member to self-register", async () => {
    const player = makePlayer();
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.attendance.create).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique).mockResolvedValue(
      makeSession({ attendances: [makeAttendance("p1", player)] }) as never,
    );

    const result = await assistantPlayerRegisterAdd({}, memberActor);

    expect(prisma.attendance.create).toHaveBeenCalledWith({
      data: { playerId: "p1", gameSessionId: "s1" },
      select: { id: true },
    });
    expect(result).toMatchObject({
      session_id: "s1",
      player: { id: "p1", display_name: "יוסי", phone: "0507654321" },
      status: "confirmed",
      position: 1,
      confirmed_count: 1,
      waitlisted_count: 0,
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ASSISTANT_SELF_REGISTER_ADD" }));
  });

  it("denies a guest self-registering", async () => {
    await expect(assistantPlayerRegisterAdd({}, guestActor)).rejects.toMatchObject({
      code: "FORBIDDEN_OPERATION",
      status: 403,
    });
  });

  it("returns ALREADY_REGISTERED for duplicate self-register", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.attendance.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: {},
        batchRequestIdx: undefined,
      }),
    );

    await expect(assistantPlayerRegisterAdd({}, memberActor)).rejects.toMatchObject({
      code: "ALREADY_REGISTERED",
      status: 409,
    });
  });

  it("puts self-registering member on the waitlist when roster is full", async () => {
    const confirmed1 = makeAttendance("p0", makePlayer({ id: "p0", phone: "0500000000", nickname: "first" }));
    const confirmed2 = makeAttendance("p2", makePlayer({ id: "p2", phone: "0502222222", nickname: "second" }));
    const self = makeAttendance("p1", makePlayer());
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ maxPlayers: 2 }) as never);
    vi.mocked(prisma.attendance.create).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique).mockResolvedValue(
      makeSession({ maxPlayers: 2, attendances: [confirmed1, confirmed2, self] }) as never,
    );

    const result = await assistantPlayerRegisterAdd({}, memberActor);

    expect(result.status).toBe("waitlisted");
    expect(result.position).toBe(3);
    expect(result.confirmed_count).toBe(2);
    expect(result.waitlisted_count).toBe(1);
  });

  it("allows a member to self-cancel before the close window", async () => {
    const self = makeAttendance("p1", makePlayer());
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce(makeSession({ attendances: [self] }) as never)
      .mockResolvedValueOnce(makeSession({ attendances: [] }) as never);
    vi.mocked(prisma.attendance.delete).mockResolvedValue({} as never);

    const result = await assistantPlayerRegisterCancel({}, memberActor);

    expect(prisma.attendance.delete).toHaveBeenCalledWith({ where: { id: "att-p1" } });
    expect(result.was_confirmed).toBe(true);
    expect(result.confirmed_count).toBe(0);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ASSISTANT_SELF_REGISTER_CANCEL" }));
  });

  it("blocks confirmed self-cancel inside the close window", async () => {
    vi.setSystemTime(new Date("2026-05-29T08:00:00.000Z"));
    const self = makeAttendance("p1", makePlayer());
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique).mockResolvedValueOnce(makeSession({ attendances: [self] }) as never);

    await expect(assistantPlayerRegisterCancel({}, memberActor)).rejects.toMatchObject({
      code: "CANCEL_WINDOW_CLOSED",
      status: 409,
    });
    expect(prisma.attendance.delete).not.toHaveBeenCalled();
  });

  it("allows waitlisted self-cancel inside the close window", async () => {
    vi.setSystemTime(new Date("2026-05-29T08:00:00.000Z"));
    const confirmed = makeAttendance("p2", makePlayer({ id: "p2", phone: "0502222222", nickname: "first" }));
    const self = makeAttendance("p1", makePlayer());
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession({ maxPlayers: 1 }) as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-p1" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce(makeSession({ maxPlayers: 1, attendances: [confirmed, self] }) as never)
      .mockResolvedValueOnce(makeSession({ maxPlayers: 1, attendances: [confirmed] }) as never);
    vi.mocked(prisma.attendance.delete).mockResolvedValue({} as never);

    const result = await assistantPlayerRegisterCancel({}, memberActor);

    expect(result.was_confirmed).toBe(false);
    expect(result.confirmed_count).toBe(1);
    expect(result.waitlisted_count).toBe(0);
  });

  it("returns NOT_REGISTERED when cancelling without attendance", async () => {
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(makeSession() as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue(null);

    await expect(assistantPlayerRegisterCancel({}, memberActor)).rejects.toMatchObject({
      code: "NOT_REGISTERED",
      status: 409,
    });
  });

  it("returns self registration status", async () => {
    const confirmed = makeAttendance("p2", makePlayer({ id: "p2", phone: "0502222222", nickname: "first" }));
    const self = makeAttendance("p1", makePlayer());
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(
      makeSession({ maxPlayers: 1, attendances: [confirmed, self] }) as never,
    );

    const result = await assistantPlayerRegisterStatus({}, memberActor);

    expect(result.registered).toBe(true);
    expect(result.status).toBe("waitlisted");
    expect(result.position).toBe(2);
    expect(result.confirmed_count).toBe(1);
    expect(result.waitlisted_count).toBe(1);
  });
});
