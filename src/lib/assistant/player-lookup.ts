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

type PriorityField = {
  field: keyof Pick<PlayerRecord, "nickname" | "firstNameHe" | "lastNameHe" | "firstNameEn" | "lastNameEn">;
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
    { field: "nickname", label: "nickname" },
    lang === "he"
      ? { field: "lastNameHe", label: "lastNameHe" }
      : { field: "lastNameEn", label: "lastNameEn" },
    lang === "he"
      ? { field: "firstNameHe", label: "firstNameHe" }
      : { field: "firstNameEn", label: "firstNameEn" },
  ];
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
  for (const { field, label } of priorityFields) {
    const matches = allPlayers.filter((p) =>
      normalizedEquals(p[field], normalizedQuery, caseInsensitive),
    );
    if (matches.length === 1) {
      return {
        status: "unique",
        player: toCandidate(matches[0]),
        matched_field: label,
        matched_value: matches[0][field] as string,
      };
    }
    if (matches.length > 1) {
      return { status: "ambiguous", candidates: matches.map(toCandidate) };
    }
  }

  // Partial fallback: contains matching, resolve only if exactly one unique player found
  const partialById = new Map<string, { player: PlayerRecord; field: string; value: string }>();
  for (const { field, label } of priorityFields) {
    for (const p of allPlayers) {
      if (partialById.has(p.id)) continue;
      if (normalizedContains(p[field], normalizedQuery, caseInsensitive)) {
        partialById.set(p.id, { player: p, field: label, value: p[field] as string });
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
