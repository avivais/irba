import { z } from "zod";

const challengeFormSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "נא להזין תאריך תקין (YYYY-MM-DD)"),
  sessionCount: z.coerce
    .number()
    .int("נא להזין מספר שלם")
    .min(1, "חייב להיות לפחות מפגש אחד"),
  minMatchesPct: z.coerce
    .number()
    .int("נא להזין מספר שלם")
    .min(0, "לא יכול להיות פחות מ-0")
    .max(100, "לא יכול להיות יותר מ-100"),
});

export type ChallengeFieldErrors = Partial<
  Record<"startDate" | "sessionCount" | "minMatchesPct", string>
>;

export type ParsedChallenge = {
  startDate: string;
  sessionCount: number;
  minMatchesPct: number;
};

export type ChallengeFormValidation =
  | { ok: true; data: ParsedChallenge }
  | { ok: false; errors: ChallengeFieldErrors };

export function parseChallengeForm(
  raw: Record<string, string | undefined>,
): ChallengeFormValidation {
  const parsed = challengeFormSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: ChallengeFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ChallengeFieldErrors;
      if (key && errors[key] === undefined) {
        errors[key] = issue.message;
      }
    }
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      startDate: parsed.data.startDate,
      sessionCount: parsed.data.sessionCount,
      minMatchesPct: parsed.data.minMatchesPct,
    },
  };
}
