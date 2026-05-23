import type { AssistantActor, AssistantOperation } from "./types";

const ADMIN_ONLY_OPERATIONS = new Set<AssistantOperation>(["session_roster_add", "session_roster_remove", "player_lookup"]);
const ANY_LEVEL_OPERATIONS = new Set<AssistantOperation>(["help", "session_status", "next_session"]);
const KNOWN_PLAYER_OPERATIONS = new Set<AssistantOperation>([
  "player_register_add",
  "player_register_cancel",
  "player_register_status",
]);

export function isKnownAssistantOperation(operation: string): operation is AssistantOperation {
  return (
    ANY_LEVEL_OPERATIONS.has(operation as AssistantOperation) ||
    KNOWN_PLAYER_OPERATIONS.has(operation as AssistantOperation) ||
    ADMIN_ONLY_OPERATIONS.has(operation as AssistantOperation)
  );
}

export function canRunAssistantOperation(actor: AssistantActor, operation: string): boolean {
  if (ANY_LEVEL_OPERATIONS.has(operation as AssistantOperation)) return true;
  if (KNOWN_PLAYER_OPERATIONS.has(operation as AssistantOperation)) return actor.level === "member" || actor.level === "admin";
  if (ADMIN_ONLY_OPERATIONS.has(operation as AssistantOperation)) return actor.level === "admin";
  return false;
}
