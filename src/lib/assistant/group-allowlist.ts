import { CONFIG } from "@/lib/config-keys";
import { getConfigValue } from "@/lib/config";

export function parseAllowedGroups(raw: string): string[] {
  return raw
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
}

export async function isAssistantGroupAllowed(groupJid: string): Promise<boolean> {
  const raw = await getConfigValue(CONFIG.ASSISTANT_ALLOWED_GROUPS);
  return parseAllowedGroups(raw).includes(groupJid);
}
