import type { AssistantActor, AssistantOperation } from "./types";

const ADMIN_ONLY_OPERATIONS = new Set<AssistantOperation>(["session_roster_add", "session_roster_remove"]);
const ANY_LEVEL_OPERATIONS = new Set<AssistantOperation>(["help", "session_status", "next_session"]);

export function isKnownAssistantOperation(operation: string): operation is AssistantOperation {
  return ANY_LEVEL_OPERATIONS.has(operation as AssistantOperation) || ADMIN_ONLY_OPERATIONS.has(operation as AssistantOperation);
}

export function canRunAssistantOperation(actor: AssistantActor, operation: string): boolean {
  if (ANY_LEVEL_OPERATIONS.has(operation as AssistantOperation)) return true;
  if (ADMIN_ONLY_OPERATIONS.has(operation as AssistantOperation)) return actor.level === "admin";
  return false;
}
