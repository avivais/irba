import type { AssistantActor } from "../types";

export type AssistantHelpOperation = {
  name: string;
  level: "any" | "member" | "admin";
};

export type AssistantHelpData = {
  operations: AssistantHelpOperation[];
  actor: {
    level: AssistantActor["level"];
    phone: string | null;
  };
};

const OPERATIONS: AssistantHelpOperation[] = [
  { name: "help", level: "any" },
  { name: "session_status", level: "any" },
  { name: "next_session", level: "any" },
  { name: "player_register_add", level: "member" },
  { name: "player_register_cancel", level: "member" },
  { name: "player_register_status", level: "member" },
  { name: "session_roster_add", level: "admin" },
  { name: "session_roster_remove", level: "admin" },
  { name: "player_lookup", level: "admin" },
  { name: "finance_summary_get", level: "admin" },
  { name: "player_balance_get", level: "member" },
  { name: "registered_player_balances_get", level: "admin" },
  { name: "player_payments_list", level: "member" },
  { name: "payment_add", level: "admin" },
];

export function getAssistantHelp(actor: AssistantActor): AssistantHelpData {
  return {
    operations: OPERATIONS,
    actor: {
      level: actor.level,
      phone: actor.normalizedPhone,
    },
  };
}
