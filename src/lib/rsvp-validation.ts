import { z } from "zod";
import { normalizePhone, PhoneValidationError } from "./phone";

/** Same rules for client preview and server action — keep in sync here only. */
export const attendFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "נא להזין שם")
    .max(80, "השם ארוך מדי (עד 80 תווים)"),
  phone: z.string().min(1, "נא להזין מספר טלפון"),
});

export const PHONE_INVALID_MESSAGE =
  "מספר הטלפון חייב להיות ישראלי בפורמט 05xxxxxxxx";

export type AttendFieldErrors = Partial<Record<"name" | "phone", string>>;

export type AttendFormValidation =
  | { ok: true; name: string; phoneNormalized: string }
  | { ok: false; errors: AttendFieldErrors };

/**
 * Live validation for the RSVP form: per-field errors + overall validity.
 */
/**
 * If Zod failed first, we still need the Israeli-format check — otherwise an empty name
 * hides a bad phone (normalizePhone never ran).
 */
function addPhoneFormatErrorIfNeeded(
  rawPhone: string,
  errors: AttendFieldErrors,
): void {
  if (errors.phone !== undefined) return;
  const trimmed = rawPhone.trim();
  if (trimmed.length === 0) return;
  try {
    normalizePhone(rawPhone);
  } catch (e) {
    if (e instanceof PhoneValidationError) {
      errors.phone = PHONE_INVALID_MESSAGE;
    } else {
      throw e;
    }
  }
}

export function getAttendFormValidation(raw: {
  name: string;
  phone: string;
}): AttendFormValidation {
  const parsed = attendFormSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: AttendFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "name" && errors.name === undefined) {
        errors.name = issue.message;
      }
      if (key === "phone" && errors.phone === undefined) {
        errors.phone = issue.message;
      }
    }
    addPhoneFormatErrorIfNeeded(raw.phone, errors);
    return { ok: false, errors };
  }
  try {
    const phoneNormalized = normalizePhone(parsed.data.phone);
    return {
      ok: true,
      name: parsed.data.name,
      phoneNormalized,
    };
  } catch (e) {
    if (e instanceof PhoneValidationError) {
      return {
        ok: false,
        errors: { phone: PHONE_INVALID_MESSAGE },
      };
    }
    throw e;
  }
}

export type AttendParseResult =
  | { ok: true; name: string; phoneNormalized: string }
  | { ok: false; message: string };

/**
 * Validates name + raw phone for RSVP. Returns normalized phone on success.
 * Use from the server action and from the client before submit.
 */
export function parseAttendFormFields(raw: {
  name: string;
  phone: string;
}): AttendParseResult {
  const v = getAttendFormValidation(raw);
  if (!v.ok) {
    return {
      ok: false,
      message: v.errors.name ?? v.errors.phone ?? "קלט לא תקין",
    };
  }
  return {
    ok: true,
    name: v.name,
    phoneNormalized: v.phoneNormalized,
  };
}
