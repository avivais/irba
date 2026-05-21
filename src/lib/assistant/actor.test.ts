import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { normalizeAssistantPhone, resolveAssistantActor } from "./actor";

describe("normalizeAssistantPhone", () => {
  it("accepts national, 972, and +972 mobile formats", () => {
    expect(normalizeAssistantPhone("050-123-4567")).toBe("0501234567");
    expect(normalizeAssistantPhone("972501234567")).toBe("0501234567");
    expect(normalizeAssistantPhone("+972 50 123 4567")).toBe("0501234567");
  });
});

describe("resolveAssistantActor", () => {
  beforeEach(() => {
    vi.mocked(prisma.player.findUnique).mockReset();
  });

  it("resolves known admin", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: "p1",
      phone: "0501234567",
      nickname: "Admin",
      firstNameHe: null,
      lastNameHe: null,
      isAdmin: true,
    });

    await expect(resolveAssistantActor("+972501234567")).resolves.toMatchObject({
      level: "admin",
      normalizedPhone: "0501234567",
    });
  });

  it("resolves known non-admin as member", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: "p2",
      phone: "0507654321",
      nickname: null,
      firstNameHe: "שחקן",
      lastNameHe: null,
      isAdmin: false,
    });

    await expect(resolveAssistantActor("0507654321")).resolves.toMatchObject({
      level: "member",
      normalizedPhone: "0507654321",
    });
  });

  it("resolves unknown phone as guest", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    await expect(resolveAssistantActor("0500000000")).resolves.toEqual({
      level: "guest",
      player: null,
      normalizedPhone: "0500000000",
    });
  });

  it("resolves malformed phone as guest without throwing", async () => {
    await expect(resolveAssistantActor("not-a-phone")).resolves.toEqual({
      level: "guest",
      player: null,
      normalizedPhone: null,
    });
  });
});
