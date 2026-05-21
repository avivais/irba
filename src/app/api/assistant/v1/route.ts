export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { resolveAssistantActor } from "@/lib/assistant/actor";
import { verifyAssistantAuth } from "@/lib/assistant/auth";
import { AssistantApiError, errorResponse, successResponse } from "@/lib/assistant/errors";
import { isAssistantGroupAllowed } from "@/lib/assistant/group-allowlist";
import { getAssistantIdempotency, storeAssistantResult } from "@/lib/assistant/idempotency";
import { getAssistantHelp } from "@/lib/assistant/operations/help";
import { canRunAssistantOperation, isKnownAssistantOperation } from "@/lib/assistant/permissions";
import { parseAssistantEnvelope } from "@/lib/assistant/schema";
import type { AssistantEnvelope, AssistantResponse } from "@/lib/assistant/types";

export async function POST(request: Request) {
  try {
    verifyAssistantAuth(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof AssistantApiError) {
      return json(errorResponse(error.code, error.message), error.status);
    }
    throw error;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(errorResponse("INVALID_JSON", "Invalid JSON"), 400);
  }

  let envelope: AssistantEnvelope;
  try {
    envelope = parseAssistantEnvelope(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      return json(errorResponse("VALIDATION_ERROR", "Invalid assistant request", error.flatten()), 400);
    }
    throw error;
  }

  if (!(await isAssistantGroupAllowed(envelope.group_jid))) {
    const response = errorResponse("FORBIDDEN_GROUP", "Group is not allowlisted");
    await storeAssistantResultSafe(envelope, "FORBIDDEN_GROUP", response);
    return json(response, 403);
  }

  const cached = await getAssistantIdempotency(envelope.idempotency_key, envelope.operation);
  if (cached.kind === "hit") {
    return json(cached.response, cached.response.ok ? 200 : statusForCode(cached.response.error?.code));
  }
  if (cached.kind === "conflict") {
    const response = errorResponse("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different operation");
    return json(response, 422);
  }

  if (!isKnownAssistantOperation(envelope.operation)) {
    const response = errorResponse("UNKNOWN_OPERATION", "Unknown assistant operation");
    await storeAssistantResultSafe(envelope, "UNKNOWN_OPERATION", response);
    return json(response, 400);
  }

  const actor = await resolveAssistantActor(envelope.actor_phone);
  if (!canRunAssistantOperation(actor, envelope.operation)) {
    const response = errorResponse("UNKNOWN_OPERATION", "Unknown assistant operation");
    await storeAssistantResultSafe(envelope, "UNKNOWN_OPERATION", response);
    return json(response, 400);
  }

  try {
    const data = getAssistantHelp(actor);
    const response = successResponse(data);
    await storeAssistantResultSafe(envelope, "OK", response);
    return json(response, 200);
  } catch {
    const response = errorResponse("INTERNAL_ERROR", "Assistant operation failed");
    await storeAssistantResultSafe(envelope, "INTERNAL_ERROR", response);
    return json(response, 500);
  }
}

function json(response: AssistantResponse, status: number) {
  return NextResponse.json(response, { status });
}

function statusForCode(code: string | undefined): number {
  switch (code) {
    case "FORBIDDEN_GROUP":
      return 403;
    case "UNKNOWN_OPERATION":
    case "INVALID_JSON":
    case "VALIDATION_ERROR":
      return 400;
    case "IDEMPOTENCY_CONFLICT":
      return 422;
    case "UNAUTHORIZED":
      return 401;
    default:
      return 500;
  }
}

async function storeAssistantResultSafe(
  envelope: AssistantEnvelope,
  resultCode: string,
  response: AssistantResponse,
): Promise<void> {
  await storeAssistantResult({
    idempotencyKey: envelope.idempotency_key,
    operation: envelope.operation,
    actorPhone: envelope.actor_phone,
    groupJid: envelope.group_jid,
    resultCode,
    response,
  });
}
