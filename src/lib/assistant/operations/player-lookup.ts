import { z } from "zod";
import { AssistantApiError } from "../errors";
import { lookupPlayerByName } from "../player-lookup";
import type { PlayerLookupCandidate } from "../player-lookup";

const paramsSchema = z
  .object({
    query: z.string().min(1),
    language_hint: z.enum(["he", "en"]).optional(),
  })
  .strict();

export type AssistantPlayerLookupData =
  | { status: "unique"; player: PlayerLookupCandidate; matched_field: string; matched_value: string }
  | { status: "ambiguous"; candidates: PlayerLookupCandidate[] }
  | { status: "not_found" };

export async function assistantPlayerLookup(params: unknown): Promise<AssistantPlayerLookupData> {
  const { query, language_hint } = paramsSchema.parse(params ?? {});

  const result = await lookupPlayerByName(query, language_hint);

  if (result.status === "mixed_language") {
    throw new AssistantApiError(
      "MIXED_LANGUAGE_AMBIGUOUS",
      "שם מעורב עברית-אנגלית, כתוב שם מלא או מספר.",
      422,
    );
  }

  return result;
}
