import type { AssistantActor } from "../types";

export type AssistantHelpData = {
  operations: string[];
  actor: {
    level: AssistantActor["level"];
    phone: string | null;
  };
};

export function getAssistantHelp(actor: AssistantActor): AssistantHelpData {
  return {
    operations: ["help", "session_status", "next_session"],
    actor: {
      level: actor.level,
      phone: actor.normalizedPhone,
    },
  };
}
