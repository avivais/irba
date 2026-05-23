export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { resolveAssistantActor } from "@/lib/assistant/actor";
import { verifyAssistantAuth } from "@/lib/assistant/auth";
import { AssistantApiError, errorResponse, successResponse } from "@/lib/assistant/errors";
import { isAssistantGroupAllowed } from "@/lib/assistant/group-allowlist";
import { getAssistantIdempotency, storeAssistantResult } from "@/lib/assistant/idempotency";
import { getAssistantNextSession } from "@/lib/assistant/operations/next-session";
import { getAssistantHelp } from "@/lib/assistant/operations/help";
import { getAssistantSessionStatus } from "@/lib/assistant/operations/session-status";
import { assistantRosterAdd } from "@/lib/assistant/operations/session-roster-add";
import { assistantRosterRemove } from "@/lib/assistant/operations/session-roster-remove";
import {
  assistantPlayerRegisterAdd,
  assistantPlayerRegisterCancel,
  assistantPlayerRegisterStatus,
} from "@/lib/assistant/operations/player-register";
import { assistantPlayerLookup } from "@/lib/assistant/operations/player-lookup";
import {
  assistantFinanceSummary,
  assistantPaymentAdd,
  assistantPlayerBalance,
  assistantPlayerPaymentsList,
} from "@/lib/assistant/operations/finance";
import { canRunAssistantOperation, isKnownAssistantOperation } from "@/lib/assistant/permissions";
import { assistantAllowedGroupsSet } from "@/lib/assistant/operations/config";
import { parseAssistantEnvelope } from "@/lib/assistant/schema";
import type { AssistantActor, AssistantEnvelope, AssistantResponse } from "@/lib/assistant/types";

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
    const response = errorResponse("FORBIDDEN_OPERATION", "Permission denied for this operation");
    await storeAssistantResultSafe(envelope, "FORBIDDEN_OPERATION", response);
    return json(response, 403);
  }

  try {
    const data = await runAssistantOperation(envelope, actor);
    const response = successResponse(data);
    await storeAssistantResultSafe(envelope, "OK", response);
    return json(response, 200);
  } catch (error) {
    if (error instanceof AssistantApiError) {
      const response = errorResponse(error.code, error.message, error.detail);
      await storeAssistantResultSafe(envelope, error.code, response);
      return json(response, error.status);
    }
    if (error instanceof ZodError) {
      const response = errorResponse("VALIDATION_ERROR", "Invalid assistant operation params", error.flatten());
      await storeAssistantResultSafe(envelope, "VALIDATION_ERROR", response);
      return json(response, 400);
    }

    const response = errorResponse("INTERNAL_ERROR", "Assistant operation failed");
    await storeAssistantResultSafe(envelope, "INTERNAL_ERROR", response);
    return json(response, 500);
  }
}

async function runAssistantOperation(envelope: AssistantEnvelope, actor: AssistantActor): Promise<unknown> {
  switch (envelope.operation) {
    case "help":
      return getAssistantHelp(actor);
    case "session_status":
      return getAssistantSessionStatus(envelope.params);
    case "next_session":
      return getAssistantNextSession();
    case "player_register_add":
      return assistantPlayerRegisterAdd(envelope.params, actor);
    case "player_register_cancel":
      return assistantPlayerRegisterCancel(envelope.params, actor);
    case "player_register_status":
      return assistantPlayerRegisterStatus(envelope.params, actor);
    case "session_roster_add":
      return assistantRosterAdd(envelope.params, actor);
    case "session_roster_remove":
      return assistantRosterRemove(envelope.params, actor);
    case "player_lookup":
      return assistantPlayerLookup(envelope.params);
    case "finance_summary_get":
      return assistantFinanceSummary(actor);
    case "player_balance_get":
      return assistantPlayerBalance(envelope.params, actor);
    case "player_payments_list":
      return assistantPlayerPaymentsList(envelope.params, actor);
    case "payment_add":
      return assistantPaymentAdd(envelope.params, actor);
    case "assistant_allowed_groups_set":
      return assistantAllowedGroupsSet(envelope.params, actor);
    default:
      throw new Error("unknown assistant operation");
  }
}

function json(response: AssistantResponse, status: number) {
  return NextResponse.json(response, { status });
}

function statusForCode(code: string | undefined): number {
  switch (code) {
    case "FORBIDDEN_GROUP":
    case "FORBIDDEN_OPERATION":
      return 403;
    case "UNKNOWN_OPERATION":
    case "INVALID_JSON":
    case "VALIDATION_ERROR":
      return 400;
    case "IDEMPOTENCY_CONFLICT":
    case "MIXED_LANGUAGE_AMBIGUOUS":
    case "INVALID_CONFIRMATION":
      return 422;
    case "UNAUTHORIZED":
      return 401;
    case "SESSION_NOT_FOUND":
    case "PLAYER_NOT_FOUND":
      return 404;
    case "SESSION_CLOSED":
    case "CANCEL_WINDOW_CLOSED":
    case "ALREADY_REGISTERED":
    case "NOT_REGISTERED":
      return 409;
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
