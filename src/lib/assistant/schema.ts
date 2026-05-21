import { z } from "zod";
import type { AssistantEnvelope } from "./types";

export const assistantEnvelopeSchema = z.object({
  operation: z.string().trim().min(1).max(80),
  actor_phone: z.string().trim().min(1).max(30),
  group_jid: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[\d-]+@g\.us$/),
  idempotency_key: z.uuid(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export function parseAssistantEnvelope(input: unknown): AssistantEnvelope {
  return assistantEnvelopeSchema.parse(input);
}
