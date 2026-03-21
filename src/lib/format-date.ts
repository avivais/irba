const JERUSALEM_TZ = "Asia/Jerusalem";

/** Display next-game datetime in Hebrew locale with Israel timezone (handles DST). */
export function formatGameDate(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: JERUSALEM_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
