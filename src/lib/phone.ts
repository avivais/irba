/**
 * Israeli mobile numbers only: national format 05 + 8 digits (10 digits total).
 * Strips all non-digits, then validates — no country code or +972 conversion.
 */

const ISRAELI_MOBILE = /^05\d{8}$/;

export class PhoneValidationError extends Error {
  constructor() {
    super("INVALID_PHONE");
    this.name = "PhoneValidationError";
  }
}

/**
 * Returns canonical digits-only phone. Use the result for all Prisma phone fields.
 * @throws PhoneValidationError if the value is not a valid Israeli mobile number.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!ISRAELI_MOBILE.test(digits)) {
    throw new PhoneValidationError();
  }
  return digits;
}
