import type { AssistantActor } from "./types";

export function isKnownAssistantOperation(operation: string): operation is "help" {
  return operation === "help";
}

export function canRunAssistantOperation(
  actor: AssistantActor,
  operation: string,
): boolean {
  if (operation === "help") return true;
  // Phase 0 has no member/admin-only operations yet. Keep actor in the
  // signature so Phase 1 can add permission rules without changing callers.
  void actor;
  return false;
}
