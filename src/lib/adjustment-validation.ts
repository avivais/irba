import { z } from "zod";

export const DESCRIPTION_MAX = 200;

const schema = z.object({
  date: z
    .string()
    .min(1, "נא לבחור תאריך")
    .refine((v) => !isNaN(Date.parse(v)), "תאריך לא תקין"),
  points: z
    .string()
    .min(1, "נא להזין נקודות")
    .refine(
      (v) => !isNaN(parseFloat(v.trim())),
      "נא להזין מספר תקין",
    )
    .transform((v) => parseFloat(v.trim()))
    .refine((p) => p !== 0, "הערך חייב להיות שונה מאפס"),
  description: z
    .string()
    .trim()
    .min(1, "נא להזין תיאור")
    .max(DESCRIPTION_MAX, `התיאור ארוך מדי (עד ${DESCRIPTION_MAX} תווים)`),
});

export type AdjustmentFieldErrors = Partial<
  Record<"date" | "points" | "description", string>
>;

export type ParsedAdjustment = {
  date: Date;
  points: number;
  description: string;
};

export type AdjustmentFormValidation =
  | { ok: true; data: ParsedAdjustment }
  | { ok: false; errors: AdjustmentFieldErrors };

export function parseAdjustmentForm(raw: {
  date?: string;
  points?: string;
  description?: string;
}): AdjustmentFormValidation {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors: AdjustmentFieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof AdjustmentFieldErrors;
      if (key && errors[key] === undefined) {
        errors[key] = issue.message;
      }
    }
    return { ok: false, errors };
  }
  return {
    ok: true,
    data: {
      date: new Date(result.data.date),
      points: result.data.points,
      description: result.data.description,
    },
  };
}
