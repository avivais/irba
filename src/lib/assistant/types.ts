export type AssistantOperation = "help" | "session_status" | "next_session";

export type AssistantErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "FORBIDDEN_GROUP"
  | "UNKNOWN_OPERATION"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR";

export type AssistantError = {
  code: AssistantErrorCode;
  message: string;
  detail: unknown | null;
};

export type AssistantResponse<T = unknown> = {
  ok: boolean;
  data: T | null;
  error: AssistantError | null;
  idempotent_replay: boolean;
};

export type AssistantEnvelope = {
  operation: string;
  actor_phone: string;
  group_jid: string;
  idempotency_key: string;
  params: Record<string, unknown>;
};

export type PlayerSummary = {
  id: string;
  phone: string;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  isAdmin: boolean;
};

export type AssistantActor =
  | { level: "guest"; player: null; normalizedPhone: string | null }
  | { level: "member"; player: PlayerSummary; normalizedPhone: string }
  | { level: "admin"; player: PlayerSummary; normalizedPhone: string };
