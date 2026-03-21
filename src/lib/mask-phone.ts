/** Mask Israeli mobile for public lists (last 4 digits only). */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
}
