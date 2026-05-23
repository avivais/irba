import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computePlayerBalance, computePlayerBalances } from "@/lib/balance";
import { writeAuditLog } from "@/lib/audit";
import { normalizeAssistantPhone } from "../actor";
import { AssistantApiError } from "../errors";
import type { AssistantActor } from "../types";
import { getSafeAssistantDisplayName } from "./session-status";

const paymentMethods = ["CASH", "PAYBOX", "BIT", "BANK_TRANSFER", "OTHER"] as const;

const balanceParamsSchema = z
  .object({
    player_phone: z.string().optional(),
    include_breakdown: z.boolean().optional().default(false),
  })
  .strict();

const paymentsListParamsSchema = z
  .object({
    player_phone: z.string().optional(),
    limit: z.number().int().min(1).max(10).optional().default(5),
  })
  .strict();

const paymentAddParamsSchema = z
  .object({
    player_phone: z.string(),
    amount: z.number().int().positive().max(100_000),
    method: z.enum(paymentMethods),
    date: z.string().optional(),
    description: z.string().max(500).optional(),
    receipt_ref: z.string().max(500).optional(),
    confirmation_token: z.string().optional(),
  })
  .strict();

export type AssistantFinanceSummaryData = {
  total_paid: number;
  total_charged: number;
  total_balance: number;
  debtors_count: number;
  total_debt: number;
  credits_count: number;
  total_credit: number;
};

export type AssistantPlayerBalanceData = {
  player: { id: string; display_name: string; phone: string };
  total_paid: number;
  total_charged: number;
  balance: number;
  session_charges_total?: number;
  shared_expense_charges_total?: number;
};

export type AssistantPlayerPaymentsListData = {
  player: { id: string; display_name: string; phone: string };
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    method: PaymentMethod;
    description: string | null;
  }>;
};

export type AssistantPaymentAddData =
  | {
      requires_confirmation: true;
      confirmation_token: string;
      payment: {
        player: { id: string; display_name: string; phone: string };
        amount: number;
        method: PaymentMethod;
        date: string;
        description: string | null;
        receipt_ref: string | null;
      };
    }
  | {
      requires_confirmation: false;
      payment_id: string;
      payment: {
        player: { id: string; display_name: string; phone: string };
        amount: number;
        method: PaymentMethod;
        date: string;
        description: string | null;
        receipt_ref: string | null;
      };
      balance: AssistantPlayerBalanceData;
    };

type FinancePlayer = {
  id: string;
  phone: string;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
};

type PaymentTokenPayload = {
  v: 1;
  op: "payment_add";
  player_phone: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  description: string | null;
  receipt_ref: string | null;
};

export async function assistantFinanceSummary(actor: AssistantActor): Promise<AssistantFinanceSummaryData> {
  requireAdmin(actor);

  const players = await prisma.player.findMany({ select: { id: true } });
  const balances = await computePlayerBalances(players.map((p) => p.id));

  let totalPaid = 0;
  let totalCharged = 0;
  let totalBalance = 0;
  let debtorsCount = 0;
  let totalDebt = 0;
  let creditsCount = 0;
  let totalCredit = 0;

  for (const p of players) {
    const b = balances.get(p.id);
    if (!b) continue;
    totalPaid += b.totalPaid;
    totalCharged += b.totalCharged;
    totalBalance += b.balance;
    if (b.balance < 0) {
      debtorsCount += 1;
      totalDebt += Math.abs(b.balance);
    } else if (b.balance > 0) {
      creditsCount += 1;
      totalCredit += b.balance;
    }
  }

  return {
    total_paid: totalPaid,
    total_charged: totalCharged,
    total_balance: totalBalance,
    debtors_count: debtorsCount,
    total_debt: totalDebt,
    credits_count: creditsCount,
    total_credit: totalCredit,
  };
}

export async function assistantPlayerBalance(params: unknown, actor: AssistantActor): Promise<AssistantPlayerBalanceData> {
  const parsed = balanceParamsSchema.parse(params ?? {});
  const player = await resolveFinanceTarget(parsed.player_phone, actor);
  const balance = await computePlayerBalance(player.id);
  return formatBalanceData(player, balance, parsed.include_breakdown);
}

export async function assistantPlayerPaymentsList(
  params: unknown,
  actor: AssistantActor,
): Promise<AssistantPlayerPaymentsListData> {
  const parsed = paymentsListParamsSchema.parse(params ?? {});
  const player = await resolveFinanceTarget(parsed.player_phone, actor);
  const payments = await prisma.payment.findMany({
    where: { playerId: player.id },
    orderBy: { date: "desc" },
    take: parsed.limit,
    select: { id: true, date: true, amount: true, method: true, description: true },
  });

  return {
    player: publicPlayer(player),
    payments: payments.map((p) => ({
      id: p.id,
      date: p.date.toISOString(),
      amount: p.amount,
      method: p.method,
      description: p.description,
    })),
  };
}

export async function assistantPaymentAdd(params: unknown, actor: AssistantActor): Promise<AssistantPaymentAddData> {
  requireAdmin(actor);
  const parsed = paymentAddParamsSchema.parse(params ?? {});
  const player = await getPlayerByPhone(parsed.player_phone);
  const verified = parsed.confirmation_token ? verifyPaymentToken(parsed.confirmation_token) : null;
  if (parsed.confirmation_token && !verified) {
    throw new AssistantApiError("INVALID_CONFIRMATION", "Invalid payment confirmation token", 422);
  }

  // On confirmation, the admin may simply answer “אשר תשלום” without repeating
  // the exact timestamp. Reuse the signed token date unless a date was supplied.
  const date = parsed.date ? normalizePaymentDate(parsed.date) : verified ? normalizePaymentDate(verified.date) : normalizePaymentDate(undefined);
  const description = parsed.description?.trim() || verified?.description || null;
  const receiptRef = parsed.receipt_ref?.trim() || verified?.receipt_ref || null;
  const payload: PaymentTokenPayload = {
    v: 1,
    op: "payment_add",
    player_phone: player.phone,
    amount: parsed.amount,
    method: parsed.method,
    date: date.toISOString(),
    description,
    receipt_ref: receiptRef,
  };

  if (!parsed.confirmation_token) {
    return {
      requires_confirmation: true,
      confirmation_token: signPaymentToken(payload),
      payment: paymentPreview(player, payload),
    };
  }

  if (!verified || !samePaymentPayload(payload, verified)) {
    throw new AssistantApiError("INVALID_CONFIRMATION", "Invalid payment confirmation token", 422);
  }

  const payment = await prisma.payment.create({
    data: {
      playerId: player.id,
      date,
      amount: parsed.amount,
      method: parsed.method,
      description: buildPaymentDescription(description, receiptRef),
    },
    select: { id: true },
  });

  writeAuditLog({
    actor: actor.player!.id,
    action: "ASSISTANT_PAYMENT_ADD",
    entityType: "Payment",
    entityId: payment.id,
    after: {
      playerId: player.id,
      playerPhone: player.phone,
      amount: parsed.amount,
      method: parsed.method,
      date: date.toISOString(),
      description,
      receiptRef,
    },
  });

  return {
    requires_confirmation: false,
    payment_id: payment.id,
    payment: paymentPreview(player, payload),
    balance: await assistantPlayerBalance({ player_phone: player.phone }, actor),
  };
}

async function resolveFinanceTarget(playerPhone: string | undefined, actor: AssistantActor): Promise<FinancePlayer> {
  if (!playerPhone) {
    if (actor.level === "guest" || !actor.player) {
      throw new AssistantApiError("FORBIDDEN_OPERATION", "Known player required", 403);
    }
    return getPlayerByPhone(actor.player.phone);
  }

  if (actor.level !== "admin") {
    const normalized = normalizeAssistantPhone(playerPhone);
    if (actor.normalizedPhone && normalized === actor.normalizedPhone) return getPlayerByPhone(normalized);
    throw new AssistantApiError("FORBIDDEN_OPERATION", "Only admins can query other players", 403);
  }

  return getPlayerByPhone(playerPhone);
}

async function getPlayerByPhone(phone: string): Promise<FinancePlayer> {
  const normalized = normalizeAssistantPhone(phone);
  const player = await prisma.player.findUnique({
    where: { phone: normalized },
    select: {
      id: true,
      phone: true,
      nickname: true,
      firstNameHe: true,
      lastNameHe: true,
      firstNameEn: true,
      lastNameEn: true,
    },
  });
  if (!player) throw new AssistantApiError("PLAYER_NOT_FOUND", "Player not found", 404);
  return player;
}

function requireAdmin(actor: AssistantActor): void {
  if (actor.level !== "admin") throw new AssistantApiError("FORBIDDEN_OPERATION", "Admin required", 403);
}

function publicPlayer(player: FinancePlayer) {
  return { id: player.id, display_name: getSafeAssistantDisplayName(player), phone: player.phone };
}

function formatBalanceData(
  player: FinancePlayer,
  balance: Awaited<ReturnType<typeof computePlayerBalance>>,
  includeBreakdown: boolean,
): AssistantPlayerBalanceData {
  return {
    player: publicPlayer(player),
    total_paid: balance.totalPaid,
    total_charged: balance.totalCharged,
    balance: balance.balance,
    ...(includeBreakdown
      ? {
          session_charges_total: balance.sessionChargesTotal,
          shared_expense_charges_total: balance.sharedExpenseChargesTotal,
        }
      : {}),
  };
}

function normalizePaymentDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new AssistantApiError("VALIDATION_ERROR", "Invalid payment date", 400);
  return date;
}

function paymentPreview(player: FinancePlayer, payload: PaymentTokenPayload) {
  return {
    player: publicPlayer(player),
    amount: payload.amount,
    method: payload.method,
    date: payload.date,
    description: payload.description,
    receipt_ref: payload.receipt_ref,
  };
}

function buildPaymentDescription(description: string | null, receiptRef: string | null): string | null {
  const parts = [description, receiptRef ? `receipt:${receiptRef}` : null].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

function signingSecret(): string {
  const secret = process.env.ASSISTANT_API_SECRET;
  if (!secret) throw new AssistantApiError("UNAUTHORIZED", "Assistant secret missing", 401);
  return secret;
}

function signPaymentToken(payload: PaymentTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyPaymentToken(token: string): PaymentTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const checked = z
      .object({
        v: z.literal(1),
        op: z.literal("payment_add"),
        player_phone: z.string(),
        amount: z.number().int().positive(),
        method: z.enum(paymentMethods),
        date: z.string(),
        description: z.string().nullable(),
        receipt_ref: z.string().nullable(),
      })
      .parse(parsed);
    return checked;
  } catch {
    return null;
  }
}

function samePaymentPayload(a: PaymentTokenPayload, b: PaymentTokenPayload): boolean {
  return (
    a.player_phone === b.player_phone &&
    a.amount === b.amount &&
    a.method === b.method &&
    a.date === b.date &&
    a.description === b.description &&
    a.receipt_ref === b.receipt_ref
  );
}
