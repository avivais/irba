import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { checkDatabase } from "./health";

describe("checkDatabase", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  it("returns up when the query succeeds", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue(undefined as never);
    await expect(checkDatabase()).resolves.toEqual({ database: "up" });
  });

  it("returns down when the query throws", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused"));
    await expect(checkDatabase()).resolves.toEqual({ database: "down" });
  });
});
