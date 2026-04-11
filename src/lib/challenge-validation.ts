import { z } from "zod";
import type { ChallengeMetric } from "@/lib/challenge-analytics";

export const METRIC_VALUES = ["win_ratio", "total_wins", "attendance"] as const;

export const METRIC_LABELS: Record<ChallengeMetric, string> = {
  win_ratio: "אחוז ניצחונות",
  total_wins: "סה״כ ניצחונות",
  attendance: "נוכחות",
};

export const METRIC_DESCRIPTIONS: Record<ChallengeMetric, string> = {
  win_ratio: "ניצחונות מחולק בסה״כ משחקים שהוכרעו (ללא תיקו)",
  total_wins: "מספר כולל של ניצחונות",
  attendance: "מספר אימונים שהגיע אליהם שחקן",
};

const challengeFormSchema = z.object({
  title: z.string().trim().min(1, "נא להזין כותרת"),
  metric: z.enum(METRIC_VALUES, { message: "מדד לא תקין" }),
  eligibilityMinPct: z.coerce
    .number()
    .int("נא להזין מספר שלם")
    .min(0, "לא יכול להיות פחות מ-0")
    .max(100, "לא יכול להיות יותר מ-100"),
  roundCount: z.coerce
    .number()
    .int("נא להזין מספר שלם")
    .min(0, "לא יכול להיות פחות מ-0"),
  prize: z.string().trim().optional(),
});

export type ChallengeFieldErrors = Partial<
  Record<"title" | "metric" | "eligibilityMinPct" | "roundCount" | "prize", string>
>;

export type ParsedChallenge = {
  title: string;
  metric: ChallengeMetric;
  eligibilityMinPct: number;
  roundCount: number;
  prize: string | null;
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
      title: parsed.data.title,
      metric: parsed.data.metric,
      eligibilityMinPct: parsed.data.eligibilityMinPct,
      roundCount: parsed.data.roundCount,
      prize: parsed.data.prize?.trim() || null,
    },
  };
}
