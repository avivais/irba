import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { detectQueryLanguage, lookupPlayerByName } from "./player-lookup";

type PlayerRecord = {
  id: string;
  phone: string;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
};

function makePlayer(overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    id: "p1",
    phone: "0501234567",
    nickname: null,
    firstNameHe: null,
    lastNameHe: null,
    firstNameEn: null,
    lastNameEn: null,
    ...overrides,
  };
}

describe("detectQueryLanguage", () => {
  it("detects Hebrew-only", () => {
    expect(detectQueryLanguage("פוגל")).toBe("he");
  });

  it("detects English-only", () => {
    expect(detectQueryLanguage("Fogel")).toBe("en");
  });

  it("detects mixed Hebrew-English", () => {
    expect(detectQueryLanguage("פוגלFogel")).toBe("mixed");
  });

  it("treats digits/symbols as English (no Hebrew letters)", () => {
    expect(detectQueryLanguage("123")).toBe("en");
  });
});

describe("lookupPlayerByName", () => {
  beforeEach(() => {
    vi.mocked(prisma.player.findMany).mockReset();
  });

  it("returns mixed_language without querying DB when query is Hebrew-Latin mix", async () => {
    const result = await lookupPlayerByName("פוגלFogel");
    expect(result.status).toBe("mixed_language");
    expect(prisma.player.findMany).not.toHaveBeenCalled();
  });

  it("Hebrew nickname exact match wins over Hebrew last name", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", nickname: "פוגל" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", lastNameHe: "פוגל" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    const result = await lookupPlayerByName("פוגל");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
      expect(result.matched_field).toBe("nickname");
    }
  });

  it("Hebrew first name exact match wins over Hebrew last name", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", lastNameHe: "אדיר" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", firstNameHe: "אדיר" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    const result = await lookupPlayerByName("אדיר");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p2");
      expect(result.matched_field).toBe("firstNameHe");
    }
  });

  it("English nickname exact match wins over English last name", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", nickname: "Fogel" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", lastNameEn: "Fogel" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    const result = await lookupPlayerByName("Fogel");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
      expect(result.matched_field).toBe("nickname");
    }
  });

  it("English first name exact match wins over English last name", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", lastNameEn: "Cohen" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", firstNameEn: "Cohen" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    const result = await lookupPlayerByName("Cohen");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p2");
      expect(result.matched_field).toBe("firstNameEn");
    }
  });

  it("lower-priority fields are not checked when a higher-priority level already matched", async () => {
    // p1 matches at nickname; p2 would match at lastNameHe — but we stop at nickname level
    const p1 = makePlayer({ id: "p1", phone: "050-111", nickname: "יוסי" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", lastNameHe: "יוסי" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    const result = await lookupPlayerByName("יוסי");
    // Only p1 matches at nickname level; p2 only matches at lastNameHe
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
    }
  });

  it("returns ambiguous when multiple players match at the same priority level", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", lastNameHe: "לוי" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", lastNameHe: "לוי" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    const result = await lookupPlayerByName("לוי");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.id)).toContain("p1");
      expect(result.candidates.map((c) => c.id)).toContain("p2");
    }
  });

  it("matches Hebrew full name after nickname, first name, and last name", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", firstNameHe: "אורי", lastNameHe: "חזן" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("אורי חזן");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
      expect(result.matched_field).toBe("fullNameHe");
    }
  });

  it("returns not_found when no player matches anywhere", async () => {
    const p1 = makePlayer({ id: "p1", nickname: "יוסי", lastNameHe: "לוי", firstNameHe: "יוסף" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("פוגל");
    expect(result.status).toBe("not_found");
  });

  it("English matching is case-insensitive", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", lastNameEn: "Fogel" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("fogel");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
    }
  });

  it("Hebrew matching is exact (case-sensitive equivalent — no case folding)", async () => {
    const p1 = makePlayer({ id: "p1", lastNameHe: "לוי" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    // Exact match works
    const hit = await lookupPlayerByName("לוי");
    expect(hit.status).toBe("unique");

    // Different spelling yields not_found (no partial exact)
    const miss = await lookupPlayerByName("לבי");
    expect(miss.status).toBe("not_found");
  });

  it("normalizes leading/trailing whitespace in query", async () => {
    const p1 = makePlayer({ id: "p1", nickname: "פוגל" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("  פוגל  ");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
    }
  });

  it("normalizes repeated internal whitespace in query", async () => {
    const p1 = makePlayer({ id: "p1", firstNameEn: "Ben David", lastNameEn: null });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("Ben  David");
    expect(result.status).toBe("unique");
  });

  it("partial fallback resolves when exactly one player contains the query", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", lastNameEn: "Fogelman" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("Fogel");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
      expect(result.matched_field).toBe("lastNameEn");
    }
  });

  it("partial fallback returns ambiguous when multiple players contain the query", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", lastNameEn: "Fogel" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", lastNameEn: "Fogelman" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    // "Fog" partially matches both
    const result = await lookupPlayerByName("Fog");
    expect(result.status).toBe("ambiguous");
  });

  it("Hebrew partial fallback finds unique player by nickname prefix", async () => {
    const p1 = makePlayer({ id: "p1", phone: "050-111", nickname: "פוגלמן" });
    const p2 = makePlayer({ id: "p2", phone: "050-222", nickname: "כהן" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1, p2] as never);

    const result = await lookupPlayerByName("פוגל");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.id).toBe("p1");
    }
  });

  it("language_hint overrides auto-detection for the lookup path", async () => {
    // Player has English fields; we force language_hint="en" on what looks like a numeric/plain token
    const p1 = makePlayer({ id: "p1", phone: "050-111", lastNameEn: "Adir" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("Adir", "en");
    expect(result.status).toBe("unique");
  });

  it("display_name uses nickname when present", async () => {
    const p1 = makePlayer({ id: "p1", nickname: "יוסי", firstNameHe: "יוסף", lastNameHe: "לוי" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("יוסי");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.display_name).toBe("יוסי");
    }
  });

  it("display_name falls back to Hebrew name when no nickname", async () => {
    const p1 = makePlayer({ id: "p1", firstNameHe: "יוסף", lastNameHe: "לוי" });
    vi.mocked(prisma.player.findMany).mockResolvedValue([p1] as never);

    const result = await lookupPlayerByName("לוי");
    expect(result.status).toBe("unique");
    if (result.status === "unique") {
      expect(result.player.display_name).toBe("יוסף לוי");
    }
  });

  it("returns not_found on empty player list", async () => {
    vi.mocked(prisma.player.findMany).mockResolvedValue([] as never);
    const result = await lookupPlayerByName("פוגל");
    expect(result.status).toBe("not_found");
  });
});
