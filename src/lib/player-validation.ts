import { z } from "zod";
import { normalizePhone, PhoneValidationError } from "./phone";

export const PHONE_INVALID_MESSAGE =
  "מספר הטלפון חייב להיות ישראלי בפורמט 05xxxxxxxx";

export const PLAYER_RANK_MIN = 1;
export const PLAYER_RANK_MAX = 100;

export const POSITION_VALUES = ["PG", "SG", "SF", "PF", "C"] as const;
export type PositionValue = (typeof POSITION_VALUES)[number];

export const playerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "נא להזין שם")
    .max(80, "השם ארוך מדי (עד 80 תווים)"),
  phone: z.string().min(1, "נא להזין מספר טלפון"),
  playerKind: z.enum(["REGISTERED", "DROP_IN"]),
  rank: z.string().optional(),
  balance: z.string().optional(),
  isAdmin: z.string().optional(),
});

export type PlayerFieldErrors = Partial<
  Record<"name" | "phone" | "playerKind" | "positions" | "rank" | "balance", string>
>;

export type ParsedPlayer = {
  name: string;
  phoneNormalized: string;
  playerKind: "REGISTERED" | "DROP_IN";
  positions: PositionValue[];
  rank: number | null;
  balance: number;
  isAdmin: boolean;
};

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

  // Parse balance (optional int, allow negative)
  let balance = 0;
  if (parsed.data.balance !== undefined && parsed.data.balance.trim() !== "") {
    const b = parseInt(parsed.data.balance, 10);
    if (isNaN(b)) {
      return { ok: false, errors: { balance: "נא להזין מספר שלם" } };
    }
    balance = b;
  }

  const isAdmin = parsed.data.isAdmin === "on";

  return {
    ok: true,
    data: {
      name: parsed.data.name,
      phoneNormalized,
      playerKind: parsed.data.playerKind,
      positions,
      rank,
      balance,
      isAdmin,
    },
  };
}
