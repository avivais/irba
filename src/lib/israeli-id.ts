/**
 * Israeli national ID (Mispar Zehut) validation.
 *
 * Algorithm: pad to 9 digits, alternate multiply each digit by 1 or 2,
 * subtract 9 from any product > 9, sum all results — valid if sum % 10 === 0.
 */

function stripAndPad(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 9) return null;
  return digits.padStart(9, "0");
}

function luhnSum(padded: string): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(padded[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum;
}

/** Returns true iff `raw` represents a valid Israeli national ID. */
export function isValidIsraeliId(raw: string): boolean {
  const padded = stripAndPad(raw);
  if (!padded) return false;
  return luhnSum(padded) % 10 === 0;
}

/**
 * Returns the zero-padded 9-digit canonical form.
 * Throws if the ID is invalid.
 */
export function normalizeIsraeliId(raw: string): string {
  const padded = stripAndPad(raw);
  if (!padded || luhnSum(padded) % 10 !== 0) {
    throw new Error(`Invalid Israeli ID: "${raw}"`);
  }
  return padded;
}
