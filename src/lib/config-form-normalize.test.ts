import { describe, expect, it } from "vitest";
import { CONFIG, CONFIG_DEFAULTS, type ConfigKey } from "@/lib/config-keys";
import { parseConfigForm } from "@/lib/config-validation";
import { normalizeConfigFormRaw } from "@/lib/config-form-normalize";

describe("normalizeConfigFormRaw", () => {
  it("preserves hidden config keys that are not rendered in the admin form", () => {
    const existing = {
      ...CONFIG_DEFAULTS,
      [CONFIG.ASSISTANT_ALLOWED_GROUPS]: "120363409761679942@g.us",
      [CONFIG.ASSISTANT_LOG_RETENTION_DAYS]: "14",
    } satisfies Record<ConfigKey, string>;

    const raw = {
      [CONFIG.WA_GROUP_JID]: "120363000000000000@g.us",
      [CONFIG.WA_GROUP_INVITE_LINK]: "",
    };

    const normalized = normalizeConfigFormRaw(raw, existing);

    expect(normalized[CONFIG.WA_GROUP_JID]).toBe("120363000000000000@g.us");
    expect(normalized[CONFIG.ASSISTANT_ALLOWED_GROUPS]).toBe("120363409761679942@g.us");
    expect(normalized[CONFIG.ASSISTANT_LOG_RETENTION_DAYS]).toBe("14");
    expect(parseConfigForm(normalized).ok).toBe(true);
  });

  it("treats omitted rendered checkbox keys as false", () => {
    const existing = {
      ...CONFIG_DEFAULTS,
      [CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED]: "true",
    } satisfies Record<ConfigKey, string>;

    const normalized = normalizeConfigFormRaw({}, existing);

    expect(normalized[CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED]).toBe("false");
  });
});
