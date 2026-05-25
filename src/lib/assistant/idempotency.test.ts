import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assistantRequestLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getAssistantIdempotency, storeAssistantResult } from "./idempotency";

const response = {
  ok: true,
  data: { operations: ["help"] },
  error: null,
  idempotent_replay: false,
};

describe("assistant idempotency", () => {
  beforeEach(() => {
    vi.mocked(prisma.assistantRequestLog.findUnique).mockReset();
    vi.mocked(prisma.assistantRequestLog.create).mockReset();
  });

  it("returns miss for a new key", async () => {
    vi.mocked(prisma.assistantRequestLog.findUnique).mockResolvedValue(null);
    await expect(getAssistantIdempotency("k", "help")).resolves.toEqual({ kind: "miss" });
  });

  it("returns cached result for existing same-operation key", async () => {
    vi.mocked(prisma.assistantRequestLog.findUnique).mockResolvedValue({
      operation: "help",
      resultSnapshot: response,
    } as never);

    await expect(getAssistantIdempotency("k", "help")).resolves.toEqual({
      kind: "hit",
      response: { ...response, idempotent_replay: true },
    });
  });

  it("reports conflict for existing different-operation key", async () => {
    vi.mocked(prisma.assistantRequestLog.findUnique).mockResolvedValue({
      operation: "roster.add",
      resultSnapshot: response,
    } as never);

    await expect(getAssistantIdempotency("k", "help")).resolves.toEqual({ kind: "conflict" });
  });

  it("stores sanitized result snapshots", async () => {
    vi.mocked(prisma.assistantRequestLog.create).mockResolvedValue({} as never);
    await storeAssistantResult({
      idempotencyKey: "k",
      operation: "help",
      actorPhone: "0501234567",
      groupJid: "120363409761679942@g.us",
      resultCode: "OK",
      response,
    });

    expect(prisma.assistantRequestLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: "k",
        operation: "help",
        resultCode: "OK",
        resultSnapshot: response,
      }),
    });
  });
});
