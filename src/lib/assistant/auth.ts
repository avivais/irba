import { timingSafeEqual } from "node:crypto";
import { AssistantApiError } from "./errors";

export function verifyAssistantAuth(authorization: string | null): void {
  const secret = process.env.ASSISTANT_API_SECRET;
  if (!secret) {
    throw new AssistantApiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) {
    throw new AssistantApiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const token = authorization.slice(prefix.length);
  if (!constantTimeEquals(token, secret)) {
    throw new AssistantApiError("UNAUTHORIZED", "Unauthorized", 401);
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
