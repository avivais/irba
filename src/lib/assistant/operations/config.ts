import { CONFIG } from "@/lib/config-keys";
import { getConfigValue, setConfigs } from "@/lib/config";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import type { AssistantActor } from "../types";

const setAllowedGroupsSchema = z.object({
  group_jid: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[\d-]+@g\.us$/),
});

export type AssistantAllowedGroupsSetData = {
  assistant_allowed_groups: string;
};

export async function assistantAllowedGroupsSet(
  params: Record<string, unknown>,
  actor: AssistantActor,
): Promise<AssistantAllowedGroupsSetData> {
  const parsed = setAllowedGroupsSchema.parse(params);
  const before = await getConfigValue(CONFIG.ASSISTANT_ALLOWED_GROUPS);

  await setConfigs({ [CONFIG.ASSISTANT_ALLOWED_GROUPS]: parsed.group_jid });

  writeAuditLog({
    actor: actor.normalizedPhone ?? "assistant",
    action: "UPDATE_CONFIG",
    entityType: "AppConfig",
    entityId: CONFIG.ASSISTANT_ALLOWED_GROUPS,
    before: { [CONFIG.ASSISTANT_ALLOWED_GROUPS]: before },
    after: { [CONFIG.ASSISTANT_ALLOWED_GROUPS]: parsed.group_jid },
  });

  return { assistant_allowed_groups: parsed.group_jid };
}
