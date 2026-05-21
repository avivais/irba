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
    operations: ["help"],
    actor: {
      level: actor.level,
      phone: actor.normalizedPhone,
    },
  };
}
