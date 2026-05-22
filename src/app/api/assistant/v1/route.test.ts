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
    },
    playerYearAggregate: { findMany: vi.fn() },
    playerAdjustment: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
    yearWeight: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
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
    vi.mocked(prisma.playerYearAggregate.findMany).mockReset();
    vi.mocked(prisma.playerAdjustment.findMany).mockReset();
    vi.mocked(prisma.attendance.groupBy).mockReset();
    vi.mocked(prisma.yearWeight.findMany).mockReset();
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
      data: { operations: ["help", "session_status", "next_session"], actor: { level: "guest", phone: "0501234567" } },
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
    });

    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.idempotent_replay).toBe(true);
    expect(prisma.assistantRequestLog.create).not.toHaveBeenCalled();
  });
});
