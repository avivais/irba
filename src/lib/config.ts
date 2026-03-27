import { prisma } from "@/lib/prisma";
export { CONFIG, CONFIG_DEFAULTS, type ConfigKey } from "@/lib/config-keys";
import { CONFIG, CONFIG_DEFAULTS, type ConfigKey } from "@/lib/config-keys";

// ─── Low-level getters ────────────────────────────────────────────────────────

export async function getConfigValue(key: ConfigKey): Promise<string> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  return row?.value ?? CONFIG_DEFAULTS[key];
}

/** Fetch all config keys merged with defaults — one DB round-trip. */
export async function getAllConfigs(): Promise<Record<ConfigKey, string>> {
  const rows = await prisma.appConfig.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const result = {} as Record<ConfigKey, string>;
  for (const key of Object.values(CONFIG)) {
    result[key] = stored[key] ?? CONFIG_DEFAULTS[key];
  }
  return result;
}

// ─── Typed convenience getters ────────────────────────────────────────────────

export async function getConfigInt(key: ConfigKey): Promise<number> {
  return parseInt(await getConfigValue(key), 10);
}

export async function getConfigFloat(key: ConfigKey): Promise<number> {
  return parseFloat(await getConfigValue(key));
}

// ─── Setter ───────────────────────────────────────────────────────────────────

export async function setConfigs(entries: Partial<Record<ConfigKey, string>>): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.appConfig.upsert({
        where:  { key },
        update: { value: value! },
        create: { key, value: value! },
      })
    )
  );
}

// ─── Map link helpers (no API key needed) ─────────────────────────────────────

export function googleMapsUrl(lat: string, lng: string): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function wazeUrl(lat: string, lng: string): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}
