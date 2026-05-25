import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    assistantRequestLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    gameSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    playerYearAggregate: { findMany: vi.fn() },
    playerAdjustment: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    yearWeight: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/sort-attendances", () => ({
  sortAttendancesByPrecedence: vi.fn(async (attendances) => attendances),
}));

import { prisma } from "@/lib/prisma";
import { sortAttendancesByPrecedence } from "@/lib/sort-attendances";
import { POST } from "./route";

const secret = "s".repeat(32);
const body = {
  operation: "help",
  actor_phone: "0501234567",
  group_jid: "120363409761679942@g.us",
  idempotency_key: "00000000-0000-4000-8000-000000000001",
  params: {},
};

function request(payload = body, token = secret) {
  return new Request("http://localhost/api/assistant/v1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/assistant/v1", () => {
  beforeEach(() => {
    process.env.ASSISTANT_API_SECRET = secret;
    vi.mocked(prisma.appConfig.findUnique).mockReset();
    vi.mocked(prisma.player.findUnique).mockReset();
    vi.mocked(prisma.assistantRequestLog.findUnique).mockReset();
    vi.mocked(prisma.assistantRequestLog.create).mockReset();
    vi.mocked(prisma.gameSession.findFirst).mockReset();
    vi.mocked(prisma.gameSession.findUnique).mockReset();
    vi.mocked(prisma.playerYearAggregate.findMany).mockReset();
    vi.mocked(prisma.playerAdjustment.findMany).mockReset();
    vi.mocked(prisma.attendance.groupBy).mockReset();
    vi.mocked(prisma.attendance.create).mockReset();
    vi.mocked(prisma.attendance.findFirst).mockReset();
    vi.mocked(prisma.attendance.delete).mockReset();
    vi.mocked(prisma.yearWeight.findMany).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockReset();
    vi.mocked(sortAttendancesByPrecedence).mockImplementation(async (attendances) => attendances);
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      key: "assistant_allowed_groups",
      value: body.group_jid,
      updatedAt: new Date(),
    });
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.assistantRequestLog.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.assistantRequestLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.playerYearAggregate.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.playerAdjustment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.yearWeight.findMany).mockResolvedValue([] as never);
  });

  afterEach(() => {
    delete process.env.ASSISTANT_API_SECRET;
  });

  it("returns 401 without auth", async () => {
    const res = await POST(
      new Request("http://localhost/api/assistant/v1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(res.status).toBe(401);
    expect(prisma.assistantRequestLog.create).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-allowlisted group", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      key: "assistant_allowed_groups",
      value: "972507666550-1441540291@g.us",
      updatedAt: new Date(),
    });

    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN_GROUP");
    expect(prisma.assistantRequestLog.create).toHaveBeenCalled();
  });

  it("returns help for a valid request", async () => {
    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      data: {
        operations: [
          { name: "help", level: "any" },
          { name: "session_status", level: "any" },
          { name: "next_session", level: "any" },
          { name: "player_register_add", level: "member" },
          { name: "player_register_cancel", level: "member" },
          { name: "player_register_status", level: "member" },
          { name: "session_roster_add", level: "admin" },
          { name: "session_roster_remove", level: "admin" },
          { name: "player_lookup", level: "admin" },
          { name: "finance_summary_get", level: "admin" },
          { name: "player_balance_get", level: "member" },
          { name: "registered_player_balances_get", level: "admin" },
          { name: "player_payments_list", level: "member" },
          { name: "payment_add", level: "admin" },
        ],
        actor: { level: "guest", phone: "0501234567" },
      },
      error: null,
      idempotent_replay: false,
    });
  });

  it("returns next_session for a valid read-only request", async () => {
    const res = await POST(request({ ...body, operation: "next_session" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      data: { session: null },
      error: null,
      idempotent_replay: false,
    });
    expect(prisma.assistantRequestLog.create).toHaveBeenCalled();
  });

  it("returns session_status for a valid read-only request", async () => {
    const res = await POST(request({ ...body, operation: "session_status" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      data: {
        session: null,
        counts: { registered: 0, confirmed: 0, waitlisted: 0, spots_left: 0 },
        confirmed: [],
        waitlist: [],
      },
      error: null,
      idempotent_replay: false,
    });
    expect(prisma.assistantRequestLog.create).toHaveBeenCalled();
  });

  it("returns validation error for invalid operation params", async () => {
    const res = await POST(request({ ...body, operation: "session_status", params: { target: "past" } }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.assistantRequestLog.create).toHaveBeenCalled();
  });

  it("replays an idempotent response", async () => {
    vi.mocked(prisma.assistantRequestLog.findUnique).mockResolvedValue({
      operation: "help",
      resultSnapshot: {
        ok: true,
        data: { operations: ["help"] },
        error: null,
        idempotent_replay: false,
      },
    } as never);

    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.idempotent_replay).toBe(true);
    expect(prisma.assistantRequestLog.create).not.toHaveBeenCalled();
  });

  it("returns 403 FORBIDDEN_OPERATION when a member calls session_roster_add", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: "member-id",
      phone: "0501234567",
      nickname: null,
      firstNameHe: null,
      lastNameHe: null,
      isAdmin: false,
    } as never);

    const res = await POST(request({ ...body, operation: "session_roster_add", params: { player_phone: "0509999999" } }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN_OPERATION");
    expect(prisma.assistantRequestLog.create).toHaveBeenCalled();
  });

  it("returns 403 FORBIDDEN_OPERATION when a guest calls player_register_add", async () => {
    const res = await POST(request({ ...body, operation: "player_register_add", params: {} }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN_OPERATION");
    expect(prisma.assistantRequestLog.create).toHaveBeenCalled();
  });

  it("returns 200 when a member calls player_register_status", async () => {
    const memberPlayer = {
      id: "member-id",
      phone: "0501234567",
      nickname: "אבי",
      firstNameHe: null,
      lastNameHe: null,
      firstNameEn: null,
      lastNameEn: null,
      isAdmin: false,
    };
    const session = {
      id: "s1",
      date: new Date("2026-05-29T18:00:00.000Z"),
      maxPlayers: 14,
      isClosed: false,
      isArchived: false,
      cancelledAt: null,
      attendances: [
        { id: "att-member", playerId: "member-id", gameSessionId: "s1", createdAt: new Date(), player: memberPlayer },
      ],
    };

    vi.mocked(prisma.player.findUnique).mockResolvedValue(memberPlayer as never);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(session as never);

    const res = await POST(request({ ...body, operation: "player_register_status", params: {} }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({ registered: true, status: "confirmed", position: 1 });
  });

  it("returns 200 when admin calls session_roster_add (mocked happy path)", async () => {
    const adminPlayer = {
      id: "admin-id",
      phone: "0501234567",
      nickname: null,
      firstNameHe: null,
      lastNameHe: null,
      isAdmin: true,
    };
    const targetPlayer = {
      id: "target-id",
      phone: "0507654321",
      nickname: "יוסי",
      firstNameHe: null,
      lastNameHe: null,
      firstNameEn: null,
      lastNameEn: null,
    };
    const session = {
      id: "s1",
      date: new Date("2026-05-29T18:00:00.000Z"),
      maxPlayers: 14,
      isClosed: false,
      isArchived: false,
      cancelledAt: null,
      attendances: [],
    };

    vi.mocked(prisma.player.findUnique)
      .mockResolvedValueOnce(adminPlayer as never)  // actor lookup
      .mockResolvedValueOnce(targetPlayer as never); // target player lookup
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(session as never);
    vi.mocked(prisma.attendance.create).mockResolvedValue({ id: "new-att-id" } as never);
    vi.mocked(prisma.gameSession.findUnique).mockResolvedValue({
      ...session,
      attendances: [{ id: "new-att-id", playerId: "target-id", gameSessionId: "s1", createdAt: new Date(), player: targetPlayer }],
    } as never);

    const res = await POST(
      request({ ...body, operation: "session_roster_add", params: { player_phone: "0507654321" } }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("confirmed");
  });

  it("returns 200 when admin calls session_roster_remove (mocked happy path)", async () => {
    const adminPlayer = {
      id: "admin-id",
      phone: "0501234567",
      nickname: null,
      firstNameHe: null,
      lastNameHe: null,
      isAdmin: true,
    };
    const targetPlayer = {
      id: "target-id",
      phone: "0507654321",
      nickname: "יוסי",
      firstNameHe: null,
      lastNameHe: null,
      firstNameEn: null,
      lastNameEn: null,
    };
    const session = {
      id: "s1",
      date: new Date("2026-05-29T18:00:00.000Z"),
      maxPlayers: 14,
      isClosed: false,
      isArchived: false,
      cancelledAt: null,
      attendances: [],
    };
    const attWithPlayer = {
      id: "att-target",
      playerId: "target-id",
      gameSessionId: "s1",
      createdAt: new Date(),
      player: targetPlayer,
    };

    vi.mocked(prisma.player.findUnique)
      .mockResolvedValueOnce(adminPlayer as never)
      .mockResolvedValueOnce(targetPlayer as never);
    vi.mocked(prisma.gameSession.findFirst).mockResolvedValue(session as never);
    vi.mocked(prisma.attendance.findFirst).mockResolvedValue({ id: "att-target" } as never);
    vi.mocked(prisma.gameSession.findUnique)
      .mockResolvedValueOnce({ ...session, attendances: [attWithPlayer] } as never)
      .mockResolvedValueOnce({ ...session, attendances: [] } as never);
    vi.mocked(prisma.attendance.delete).mockResolvedValue({} as never);

    const res = await POST(
      request({ ...body, operation: "session_roster_remove", params: { player_phone: "0507654321" } }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.was_confirmed).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for session_roster_add with missing player_phone", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: "admin-id",
      phone: "0501234567",
      nickname: null,
      firstNameHe: null,
      lastNameHe: null,
      isAdmin: true,
    } as never);

    const res = await POST(request({ ...body, operation: "session_roster_add", params: {} }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("replays an idempotent mutation response", async () => {
    vi.mocked(prisma.assistantRequestLog.findUnique).mockResolvedValue({
      operation: "session_roster_add",
      resultSnapshot: {
        ok: true,
        data: { session_id: "s1", status: "confirmed" },
        error: null,
        idempotent_replay: false,
      },
    } as never);

    const res = await POST(
      request({ ...body, operation: "session_roster_add", params: { player_phone: "0507654321" } }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.idempotent_replay).toBe(true);
    expect(prisma.assistantRequestLog.create).not.toHaveBeenCalled();
  });
});
