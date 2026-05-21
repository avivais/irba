import type { AssistantError, AssistantErrorCode, AssistantResponse } from "./types";

export class AssistantApiError extends Error {
  constructor(
    public readonly code: AssistantErrorCode,
    message: string,
    public readonly status: number,
    public readonly detail: unknown = null,
  ) {
    super(message);
    this.name = "AssistantApiError";
  }
}

export function assistantError(
  code: AssistantErrorCode,
  message: string,
  detail: unknown = null,
): AssistantError {
  return { code, message, detail };
}

export function errorResponse(
  code: AssistantErrorCode,
  message: string,
  detail: unknown = null,
  idempotentReplay = false,
): AssistantResponse<never> {
  return {
    ok: false,
    data: null,
    error: assistantError(code, message, detail),
    idempotent_replay: idempotentReplay,
  };
}

export function successResponse<T>(
  data: T,
  idempotentReplay = false,
): AssistantResponse<T> {
  return {
    ok: true,
    data,
    error: null,
    idempotent_replay: idempotentReplay,
  };
}
