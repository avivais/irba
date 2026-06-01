import { prisma } from "@/lib/prisma";

export type PlayerLookupCandidate = {
  id: string;
  display_name: string;
  phone: string;
};

export type PlayerLookupResult =
  | { status: "unique"; player: PlayerLookupCandidate; matched_field: string; matched_value: string }
  | { status: "ambiguous"; candidates: PlayerLookupCandidate[] }
  | { status: "not_found" }
  | { status: "mixed_language" };

export type QueryLanguage = "he" | "en" | "mixed";

export function detectQueryLanguage(query: string): QueryLanguage {
  // U+0590–U+05FF: Hebrew block (letters, vowel points, punctuation)
  const hasHebrew = /[֐-׿]/.test(query);
  const hasLatin = /[a-zA-Z]/.test(query);
  if (hasHebrew && hasLatin) return "mixed";
  if (hasHebrew) return "he";
  return "en";
}

type PlayerRecord = {
  id: string;
  phone: string;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
};

type PriorityField =
  | {
      kind: "field";
      field: keyof Pick<PlayerRecord, "nickname" | "firstNameHe" | "lastNameHe" | "firstNameEn" | "lastNameEn">;
      label: string;
    }
  | {
      kind: "fullName";
      fields: readonly ["firstNameHe", "lastNameHe"] | readonly ["firstNameEn", "lastNameEn"];
      label: string;
    };

function normalizeToken(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function normalizedEquals(fieldValue: string | null | undefined, query: string, caseInsensitive: boolean): boolean {
  if (!fieldValue) return false;
  const norm = normalizeToken(fieldValue);
  if (caseInsensitive) return norm.toLowerCase() === query.toLowerCase();
  return norm === query;
}

function normalizedContains(fieldValue: string | null | undefined, query: string, caseInsensitive: boolean): boolean {
  if (!fieldValue) return false;
  const norm = normalizeToken(fieldValue);
  if (caseInsensitive) return norm.toLowerCase().includes(query.toLowerCase());
  return norm.includes(query);
}

function getPriorityFields(lang: "he" | "en"): PriorityField[] {
  return [
    { kind: "field", field: "nickname", label: "nickname" },
    lang === "he"
      ? { kind: "field", field: "firstNameHe", label: "firstNameHe" }
      : { kind: "field", field: "firstNameEn", label: "firstNameEn" },
    lang === "he"
      ? { kind: "field", field: "lastNameHe", label: "lastNameHe" }
      : { kind: "field", field: "lastNameEn", label: "lastNameEn" },
    lang === "he"
      ? { kind: "fullName", fields: ["firstNameHe", "lastNameHe"], label: "fullNameHe" }
      : { kind: "fullName", fields: ["firstNameEn", "lastNameEn"], label: "fullNameEn" },
  ];
}

function getPriorityValue(p: PlayerRecord, priority: PriorityField): string | null {
  if (priority.kind === "field") return p[priority.field];
  const fullName = priority.fields
    .map((field) => p[field]?.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || null;
}

function toCandidate(p: PlayerRecord): PlayerLookupCandidate {
  const nickname = p.nickname?.trim();
  if (nickname) return { id: p.id, phone: p.phone, display_name: nickname };
  const heName = [p.firstNameHe, p.lastNameHe]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(" ");
  if (heName) return { id: p.id, phone: p.phone, display_name: heName };
  const enName = [p.firstNameEn, p.lastNameEn]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(" ");
  if (enName) return { id: p.id, phone: p.phone, display_name: enName };
  return { id: p.id, phone: p.phone, display_name: "שחקן" };
}

export async function lookupPlayerByName(
  query: string,
  languageHint?: "he" | "en",
): Promise<PlayerLookupResult> {
  const normalizedQuery = normalizeToken(query);

  const detectedLang = detectQueryLanguage(normalizedQuery);
  if (!languageHint && detectedLang === "mixed") {
    return { status: "mixed_language" };
  }

  const lang = languageHint ?? (detectedLang as "he" | "en");
  const caseInsensitive = lang === "en";
  const priorityFields = getPriorityFields(lang);

  const allPlayers = await prisma.player.findMany({
    select: {
      id: true,
      phone: true,
      nickname: true,
      firstNameHe: true,
      lastNameHe: true,
      firstNameEn: true,
      lastNameEn: true,
    },
  });

  // Exact pass: stop at first priority level with ≥1 match
  for (const priority of priorityFields) {
    const matches = allPlayers
      .map((player) => ({ player, value: getPriorityValue(player, priority) }))
      .filter(({ value }) => normalizedEquals(value, normalizedQuery, caseInsensitive));
    if (matches.length === 1) {
      const match = matches[0];
      return {
        status: "unique",
        player: toCandidate(match.player),
        matched_field: priority.label,
        matched_value: match.value as string,
      };
    }
    if (matches.length > 1) {
      return { status: "ambiguous", candidates: matches.map(({ player }) => toCandidate(player)) };
    }
  }

  // Partial fallback: contains matching, resolve only if exactly one unique player found
  const partialById = new Map<string, { player: PlayerRecord; field: string; value: string }>();
  for (const priority of priorityFields) {
    for (const p of allPlayers) {
      if (partialById.has(p.id)) continue;
      const value = getPriorityValue(p, priority);
      if (normalizedContains(value, normalizedQuery, caseInsensitive)) {
        partialById.set(p.id, { player: p, field: priority.label, value: value as string });
      }
    }
  }

  const partialEntries = [...partialById.values()];
  if (partialEntries.length === 1) {
    const { player, field, value } = partialEntries[0];
    return { status: "unique", player: toCandidate(player), matched_field: field, matched_value: value };
  }
  if (partialEntries.length > 1) {
    return { status: "ambiguous", candidates: partialEntries.map((e) => toCandidate(e.player)) };
  }

  return { status: "not_found" };
}
