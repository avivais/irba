import { CONFIG, type ConfigKey } from "@/lib/config-keys";

const CHECKBOX_CONFIG_KEYS = [
  CONFIG.SESSION_SCHEDULE_ENABLED,
  CONFIG.ALERT_LOW_ATTENDANCE_ENABLED,
  CONFIG.ALERT_EARLY_ENABLED,
  CONFIG.ALERT_CRITICAL_ENABLED,
  CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED,
  CONFIG.WA_NOTIFY_SESSION_CLOSE_ENABLED,
  CONFIG.WA_NOTIFY_SESSION_CANCELLED_ENABLED,
  CONFIG.WA_NOTIFY_PLAYER_REGISTERED_ENABLED,
  CONFIG.WA_NOTIFY_PLAYER_CANCELLED_ENABLED,
  CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_ENABLED,
  CONFIG.WA_NOTIFY_SESSION_ROSTER_ENABLED,
  CONFIG.WA_NOTIFY_DEBTORS_ENABLED,
  CONFIG.WA_NOTIFY_DEBTORS_TAG_ENABLED,
] as const;

export function normalizeConfigFormRaw(
  raw: Record<string, string>,
  existing: Record<ConfigKey, string>,
): Record<string, string> {
  const normalized = { ...raw };

  // Checkboxes omit their key when unchecked — supply the "off" value explicitly.
  for (const key of CHECKBOX_CONFIG_KEYS) {
    normalized[key] ??= "false";
  }

  // Some config keys are intentionally not rendered in the admin form yet
  // (for example Assistant API operational keys). Preserve their current value
  // so a visible settings save does not fail validation or reset hidden config.
  for (const key of Object.values(CONFIG)) {
    normalized[key] ??= existing[key];
  }

  return normalized;
}
