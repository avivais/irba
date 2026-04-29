import { z } from "zod";
import { normalizePhone, PhoneValidationError } from "./phone";
import { isValidIsraeliId, normalizeIsraeliId } from "./israeli-id";

export const PHONE_INVALID_MESSAGE =
  "מספר הטלפון חייב להיות ישראלי בפורמט 05xxxxxxxx";

export const PLAYER_RANK_MIN = 1;
export const PLAYER_RANK_MAX = 100;

export const POSITION_VALUES = ["PG", "SG", "SF", "PF", "C"] as const;
export type PositionValue = (typeof POSITION_VALUES)[number];

export const playerFormSchema = z.object({
  phone: z.string().min(1, "נא להזין מספר טלפון"),
  playerKind: z.enum(["REGISTERED", "DROP_IN"]),
  rank: z.string().optional(),
  isAdmin: z.string().optional(),
  nickname: z.string().trim().max(50, "הכינוי ארוך מדי (עד 50 תווים)").optional(),
  firstNameHe: z.string().trim().max(80).optional(),
  lastNameHe: z.string().trim().max(80).optional(),
  firstNameEn: z.string().trim().max(80).optional(),
  lastNameEn: z.string().trim().max(80).optional(),
  birthdate: z.string().optional(),
  email: z.string().trim().email("כתובת מייל לא תקינה").or(z.literal("")).optional(),
  nationalId: z.string().optional(),
});

export const profileFormSchema = z.object({
  nickname: z.string().trim().max(50, "הכינוי ארוך מדי (עד 50 תווים)").optional(),
  firstNameHe: z.string().trim().max(80).optional(),
  lastNameHe: z.string().trim().max(80).optional(),
  firstNameEn: z.string().trim().max(80).optional(),
  lastNameEn: z.string().trim().max(80).optional(),
  birthdate: z.string().optional(),
  email: z.string().trim().email("כתובת מייל לא תקינה").or(z.literal("")).optional(),
  nationalId: z.string().optional(),
});

export type PlayerFieldErrors = Partial<
  Record<"phone" | "playerKind" | "positions" | "rank" | "nickname" | "birthdate" | "email" | "nationalId", string>
>;

export type ParsedPlayer = {
  phoneNormalized: string;
  playerKind: "REGISTERED" | "DROP_IN";
  positions: PositionValue[];
  rank: number | null;
  isAdmin: boolean;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  birthdate: Date | null;
  email: string | null;
  nationalId: string | null;
};

export type ProfileFieldErrors = Partial<
  Record<"nickname" | "firstNameHe" | "lastNameHe" | "firstNameEn" | "lastNameEn" | "birthdate" | "email" | "nationalId", string>
>;

export type ParsedProfile = {
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  birthdate: Date | null;
  email: string | null;
  nationalId: string | null;
};

export type ProfileFormValidation =
  | { ok: true; data: ParsedProfile }
  | { ok: false; errors: ProfileFieldErrors };

export type PlayerFormValidation =
  | { ok: true; data: ParsedPlayer }
  | { ok: false; errors: PlayerFieldErrors };

export function parsePlayerForm(
  raw: Record<string, string | string[] | undefined>,
): PlayerFormValidation {
  const parsed = playerFormSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: PlayerFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof PlayerFieldErrors;
      if (key && errors[key] === undefined) {
        errors[key] = issue.message;
      }
    }
    // Also check phone format even if Zod passed minimum length
    if (!errors.phone && raw.phone && (raw.phone as string).trim().length > 0) {
      try {
        normalizePhone(raw.phone as string);
      } catch (e) {
        if (e instanceof PhoneValidationError) {
          errors.phone = PHONE_INVALID_MESSAGE;
        } else {
          throw e;
        }
      }
    }
    return { ok: false, errors };
  }

  // Normalize phone
  let phoneNormalized: string;
  try {
    phoneNormalized = normalizePhone(parsed.data.phone);
  } catch (e) {
    if (e instanceof PhoneValidationError) {
      return { ok: false, errors: { phone: PHONE_INVALID_MESSAGE } };
    }
    throw e;
  }

  // Validate positions — each value must be in the predefined list
  const rawPositions = raw.positions;
  const positionsArray: string[] = Array.isArray(rawPositions)
    ? rawPositions
    : rawPositions !== undefined && rawPositions !== ""
      ? [rawPositions]
      : [];

  const invalidPositions = positionsArray.filter(
    (p) => !(POSITION_VALUES as readonly string[]).includes(p),
  );
  if (invalidPositions.length > 0) {
    return { ok: false, errors: { positions: "עמדה לא תקינה" } };
  }
  const positions = positionsArray as PositionValue[];

  // Parse rank (optional float, range 1–100)
  let rank: number | null = null;
  if (parsed.data.rank !== undefined && parsed.data.rank.trim() !== "") {
    const r = parseFloat(parsed.data.rank);
    if (isNaN(r)) {
      return { ok: false, errors: { rank: "נא להזין מספר תקין" } };
    }
    if (r < PLAYER_RANK_MIN || r > PLAYER_RANK_MAX) {
      return {
        ok: false,
        errors: { rank: `נא להזין מספר בין ${PLAYER_RANK_MIN} ל-${PLAYER_RANK_MAX}` },
      };
    }
    rank = r;
  }

  const isAdmin = parsed.data.isAdmin === "on";

  const nickname = parsed.data.nickname?.trim() || null;
  const firstNameHe = parsed.data.firstNameHe?.trim() || null;
  const lastNameHe = parsed.data.lastNameHe?.trim() || null;
  const firstNameEn = parsed.data.firstNameEn?.trim() || null;
  const lastNameEn = parsed.data.lastNameEn?.trim() || null;

  let birthdate: Date | null = null;
  if (parsed.data.birthdate && parsed.data.birthdate.trim() !== "") {
    const d = new Date(parsed.data.birthdate.trim());
    if (isNaN(d.getTime())) {
      return { ok: false, errors: { birthdate: "תאריך לא תקין" } };
    }
    birthdate = d;
  }

  const email = parsed.data.email?.trim() || null;

  let nationalId: string | null = null;
  if (parsed.data.nationalId && parsed.data.nationalId.replace(/\D/g, "").length > 0) {
    if (!isValidIsraeliId(parsed.data.nationalId)) {
      return { ok: false, errors: { nationalId: "תעודת זהות לא תקינה" } };
    }
    nationalId = normalizeIsraeliId(parsed.data.nationalId);
  }

  return {
    ok: true,
    data: {
      phoneNormalized,
      playerKind: parsed.data.playerKind,
      positions,
      rank,
      isAdmin,
      nickname,
      firstNameHe,
      lastNameHe,
      firstNameEn,
      lastNameEn,
      birthdate,
      email,
      nationalId,
    },
  };
}

export function parseProfileForm(
  raw: Record<string, string | undefined>,
): ProfileFormValidation {
  const parsed = profileFormSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: ProfileFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ProfileFieldErrors;
      if (key && errors[key] === undefined) {
        errors[key] = issue.message;
      }
    }
    return { ok: false, errors };
  }

  const errors: ProfileFieldErrors = {};

  const nickname = parsed.data.nickname?.trim() || null;
  const firstNameEn = parsed.data.firstNameEn?.trim() || null;
  const lastNameEn = parsed.data.lastNameEn?.trim() || null;

  const firstNameHe = parsed.data.firstNameHe?.trim() || null;
  if (!firstNameHe) errors.firstNameHe = "נא להזין שם פרטי";

  const lastNameHe = parsed.data.lastNameHe?.trim() || null;
  if (!lastNameHe) errors.lastNameHe = "נא להזין שם משפחה";

  const emailTrimmed = parsed.data.email?.trim() || null;
  if (!emailTrimmed) errors.email = "נא להזין כתובת מייל";

  let nationalId: string | null = null;
  const nationalIdRaw = parsed.data.nationalId?.trim() ?? "";
  if (nationalIdRaw === "" || nationalIdRaw.replace(/\D/g, "").length === 0) {
    errors.nationalId = "נא להזין תעודת זהות";
  } else if (!isValidIsraeliId(nationalIdRaw)) {
    errors.nationalId = "תעודת זהות לא תקינה";
  } else {
    nationalId = normalizeIsraeliId(nationalIdRaw);
  }

  let birthdate: Date | null = null;
  const birthdateRaw = parsed.data.birthdate?.trim() ?? "";
  if (birthdateRaw === "") {
    errors.birthdate = "נא להזין תאריך לידה";
  } else {
    const d = new Date(birthdateRaw);
    if (isNaN(d.getTime())) {
      errors.birthdate = "תאריך לא תקין";
    } else {
      birthdate = d;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      nickname,
      firstNameHe,
      lastNameHe,
      firstNameEn,
      lastNameEn,
      birthdate,
      email: emailTrimmed,
      nationalId,
    },
  };
}
