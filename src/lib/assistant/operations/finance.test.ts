import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/balance", () => ({
  computePlayerBalance: vi.fn(),
  computePlayerBalances: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { computePlayerBalance, computePlayerBalances } from "@/lib/balance";
import { writeAuditLog } from "@/lib/audit";
import {
  assistantFinanceSummary,
  assistantPaymentAdd,
  assistantPlayerBalance,
  assistantRegisteredPlayerBalances,
  assistantPlayerPaymentsList,
} from "./finance";
import type { AssistantActor } from "../types";

const adminActor: AssistantActor = {
  level: "admin",
  normalizedPhone: "0507666550",
  player: { id: "admin", phone: "0507666550", nickname: "אבי", firstNameHe: null, lastNameHe: null, isAdmin: true },
};

const memberActor: AssistantActor = {
  level: "member",
  normalizedPhone: "0501111111",
  player: { id: "p1", phone: "0501111111", nickname: "אדיר", firstNameHe: null, lastNameHe: null, isAdmin: false },
};

const player = {
  id: "p1",
  phone: "0501111111",
  nickname: "אדיר",
  firstNameHe: null,
  lastNameHe: null,
  firstNameEn: null,
  lastNameEn: null,
};

function balance(overrides = {}) {
  return {
    totalPaid: 100,
    totalCharged: 140,
    balance: -40,
    sessionChargesTotal: 120,
    sharedExpenseChargesTotal: 20,
    ...overrides,
  };
}

describe("assistant finance operations", () => {
  beforeEach(() => {
    process.env.ASSISTANT_API_SECRET = "test-secret-for-finance";
    vi.mocked(prisma.player.findMany).mockReset();
    vi.mocked(prisma.player.findUnique).mockReset();
    vi.mocked(prisma.payment.findMany).mockReset();
    vi.mocked(prisma.payment.create).mockReset();
    vi.mocked(computePlayerBalance).mockReset();
    vi.mocked(computePlayerBalances).mockReset();
    vi.mocked(writeAuditLog).mockReset();
  });

  it("returns admin finance summary", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([{ id: "p1" }, { id: "p2" }, { id: "p3" }] as never);
    vi.mocked(computePlayerBalances).mockResolvedValue(
      new Map([
        ["p1", balance({ totalPaid: 100, totalCharged: 140, balance: -40 })],
        ["p2", balance({ totalPaid: 200, totalCharged: 150, balance: 50 })],
        ["p3", balance({ totalPaid: 10, totalCharged: 10, balance: 0 })],
      ]) as never,
    );

    const result = await assistantFinanceSummary(adminActor);

    expect(result).toEqual({
      total_paid: 310,
      total_charged: 300,
      total_balance: 10,
      debtors_count: 1,
      total_debt: 40,
      credits_count: 1,
      total_credit: 50,
    });
  });

  it("blocks finance summary for non-admin", async () => {
    await expect(assistantFinanceSummary(memberActor)).rejects.toMatchObject({ code: "FORBIDDEN_OPERATION" });
  });

  it("returns balances for registered players only", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([
      { ...player, id: "p1", nickname: "אדיר", playerKind: "REGISTERED" },
      { ...player, id: "p2", phone: "0502222222", nickname: "יקיר", playerKind: "REGISTERED" },
    ] as never);
    vi.mocked(computePlayerBalances).mockResolvedValue(
      new Map([
        ["p1", balance({ totalPaid: 100, totalCharged: 140, balance: -40 })],
        ["p2", balance({ totalPaid: 200, totalCharged: 150, balance: 50 })],
      ]) as never,
    );

    const result = await assistantRegisteredPlayerBalances(adminActor);

    expect(prisma.player.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { playerKind: "REGISTERED" } }));
    expect(result.players).toEqual([
      expect.objectContaining({ player: expect.objectContaining({ display_name: "אדיר" }), balance: -40 }),
      expect.objectContaining({ player: expect.objectContaining({ display_name: "יקיר" }), balance: 50 }),
    ]);
    expect(result.totals).toMatchObject({ players_count: 2, total_balance: 10, debtors_count: 1, total_debt: 40, credits_count: 1, total_credit: 50 });
  });

  it("blocks registered player balances for non-admin", async () => {
    await expect(assistantRegisteredPlayerBalances(memberActor)).rejects.toMatchObject({ code: "FORBIDDEN_OPERATION" });
  });

  it("allows self balance for member", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(computePlayerBalance).mockResolvedValue(balance() as never);

    const result = await assistantPlayerBalance({}, memberActor);

    expect(result).toMatchObject({
      player: { id: "p1", display_name: "אדיר", phone: "0501111111" },
      total_paid: 100,
      total_charged: 140,
      balance: -40,
    });
  });

  it("blocks non-admin querying another player balance", async () => {
    await expect(assistantPlayerBalance({ player_phone: "0502222222" }, memberActor)).rejects.toMatchObject({
      code: "FORBIDDEN_OPERATION",
    });
  });

  it("allows admin to query payment history", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "pay1", date: new Date("2026-05-20T00:00:00.000Z"), amount: 80, method: "BIT", description: "test" },
    ] as never);

    const result = await assistantPlayerPaymentsList({ player_phone: "0501111111", limit: 3 }, adminActor);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    expect(result.payments).toEqual([
      { id: "pay1", date: "2026-05-20T00:00:00.000Z", amount: 80, method: "BIT", description: "test" },
    ]);
  });

  it("payment_add first step requires confirmation", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);

    const result = await assistantPaymentAdd({ player_phone: "0501111111", amount: 80, method: "BIT" }, adminActor);

    expect(result.requires_confirmation).toBe(true);
    if (result.requires_confirmation) {
      expect(result.confirmation_token).toContain(".");
      expect(result.payment.amount).toBe(80);
    }
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("payment_add confirmation creates payment and audit log", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: "pay1" } as never);
    vi.mocked(computePlayerBalance).mockResolvedValue(balance({ totalPaid: 180, totalCharged: 140, balance: 40 }) as never);

    const first = await assistantPaymentAdd({ player_phone: "0501111111", amount: 80, method: "BIT" }, adminActor);
    if (!first.requires_confirmation) throw new Error("expected confirmation");

    const confirmed = await assistantPaymentAdd(
      { player_phone: "0501111111", amount: 80, method: "BIT", confirmation_token: first.confirmation_token },
      adminActor,
    );

    expect(confirmed.requires_confirmation).toBe(false);
    if (!confirmed.requires_confirmation) {
      expect(confirmed.payment_id).toBe("pay1");
      expect(confirmed.balance.balance).toBe(40);
    }
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ playerId: "p1", amount: 80, method: "BIT" }),
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ASSISTANT_PAYMENT_ADD" }));
  });

  it("payment_add rejects tampered confirmation token", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player as never);
    const first = await assistantPaymentAdd({ player_phone: "0501111111", amount: 80, method: "BIT" }, adminActor);
    if (!first.requires_confirmation) throw new Error("expected confirmation");

    await expect(
      assistantPaymentAdd(
        { player_phone: "0501111111", amount: 90, method: "BIT", confirmation_token: first.confirmation_token },
        adminActor,
      ),
    ).rejects.toMatchObject({ code: "INVALID_CONFIRMATION" });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
