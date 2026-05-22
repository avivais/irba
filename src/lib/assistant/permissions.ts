import type { AssistantActor, AssistantOperation } from "./types";

const READ_ONLY_OPERATIONS = new Set<AssistantOperation>(["help", "session_status", "next_session"]);

export function isKnownAssistantOperation(operation: string): operation is AssistantOperation {
  return READ_ONLY_OPERATIONS.has(operation as AssistantOperation);
}

export function canRunAssistantOperation(
  actor: AssistantActor,
  operation: string,
): boolean {
  // Phase 1 exposes allowlisted group read-only operations only. The actor is
  // resolved server-side for audit/future policy, but all levels may read the
  // group-visible roster/session status.
  void actor;
  return isKnownAssistantOperation(operation);
}
