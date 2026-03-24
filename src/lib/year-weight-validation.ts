import { z } from "zod";

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;

const schema = z.object({
  year: z
    .string()
    .min(1, "נא להזין שנה")
    .refine((v) => /^\d+$/.test(v.trim()), "נא להזין שנה תקינה")
    .transform((v) => parseInt(v.trim(), 10))
    .refine(
      (y) => y >= YEAR_MIN && y <= YEAR_MAX,
      `השנה חייבת להיות בין ${YEAR_MIN} ל-${YEAR_MAX}`,
    ),
  weight: z
    .string()
    .min(1, "נא להזין משקל")
    .refine(
      (v) => !isNaN(parseFloat(v.trim())),
      "נא להזין מספר תקין",
    )
    .transform((v) => parseFloat(v.trim()))
    .refine((w) => w >= 0, "המשקל חייב להיות אפס או יותר"),
});

export type YearWeightFieldErrors = Partial<Record<"year" | "weight", string>>;

export type ParsedYearWeight = { year: number; weight: number };

export type YearWeightFormValidation =
  | { ok: true; data: ParsedYearWeight }
  | { ok: false; errors: YearWeightFieldErrors };

export function parseYearWeightForm(raw: {
  year?: string;
  weight?: string;
}): YearWeightFormValidation {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors: YearWeightFieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof YearWeightFieldErrors;
      if (key && errors[key] === undefined) {
        errors[key] = issue.message;
      }
    }
    return { ok: false, errors };
  }
  return { ok: true, data: result.data };
}
