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
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      key: "assistant_allowed_groups",
      value: body.group_jid,
      updatedAt: new Date(),
    });
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.assistantRequestLog.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.assistantRequestLog.create).mockResolvedValue({} as never);
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
      data: { operations: ["help"], actor: { level: "guest", phone: "0501234567" } },
      error: null,
      idempotent_replay: false,
    });
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
