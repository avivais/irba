import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AssistantResponse } from "./types";

export type IdempotencyLookup =
  | { kind: "miss" }
  | { kind: "hit"; response: AssistantResponse }
  | { kind: "conflict" };

export async function getAssistantIdempotency(
  idempotencyKey: string,
  operation: string,
): Promise<IdempotencyLookup> {
  const row = await prisma.assistantRequestLog.findUnique({
    where: { idempotencyKey },
    select: { operation: true, resultSnapshot: true },
  });

  if (!row) return { kind: "miss" };
  if (row.operation !== operation) return { kind: "conflict" };

  const response = row.resultSnapshot as AssistantResponse | null;
  if (!response) return { kind: "conflict" };
  return {
    kind: "hit",
    response: { ...response, idempotent_replay: true },
  };
}

export async function storeAssistantResult(args: {
  idempotencyKey: string;
  operation: string;
  actorPhone: string;
  groupJid: string;
  resultCode: string;
  response: AssistantResponse;
}): Promise<void> {
  try {
    await prisma.assistantRequestLog.create({
      data: {
        idempotencyKey: args.idempotencyKey,
        operation: args.operation,
        actorPhone: args.actorPhone,
        groupJid: args.groupJid,
        resultCode: args.resultCode,
        resultSnapshot: args.response as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // Concurrent duplicate requests are protected by the DB unique constraint.
    // The already-stored result will be returned on the next replay check.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    throw error;
  }
}
