import { prisma } from "@/lib/prisma";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { nextScheduledSession } from "@/lib/schedule";
import { notifySessionOpen } from "@/lib/wa-notify";

/** UTC start and end of the Israel calendar day containing `date`. */
function israelDayBounds(date: Date): { gte: Date; lt: Date } {
  const dayStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const midnightRef = new Date(dayStr + "T00:00Z");
  const midnightIsrael = midnightRef
    .toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" })
    .replace(" ", "T")
    .slice(0, 16);
  const offsetMs = new Date(midnightIsrael + "Z").getTime() - midnightRef.getTime();
  const gte = new Date(midnightRef.getTime() - offsetMs);
  const lt = new Date(gte.getTime() + 86_400_000);
  return { gte, lt };
}

export type AutoCreateResult =
  | { created: false; reason: string }
  | { created: true; sessionId: string };

/**
 * Idempotent: creates the next scheduled session if it's time.
 * Pass `force: true` to skip the lead-time window check (e.g. manual trigger).
 */
export async function autoCreateNextSession(opts: { force?: boolean } = {}): Promise<AutoCreateResult> {
  const configs = await getAllConfigs();

  if (configs[CONFIG.SESSION_SCHEDULE_ENABLED] !== "true") {
    return { created: false, reason: "schedule disabled" };
  }

  const scheduleDayOfWeek = parseInt(configs[CONFIG.SESSION_SCHEDULE_DAY], 10);
  const scheduleTime = configs[CONFIG.SESSION_SCHEDULE_TIME];
  const hoursBeforeCreate = parseInt(configs[CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE], 10);
  const maxPlayers = 15;

  const now = new Date();
  const nextSession = nextScheduledSession(scheduleDayOfWeek, scheduleTime, now);

  if (!opts.force) {
    const createWindowStart = new Date(nextSession.getTime() - hoursBeforeCreate * 3_600_000);
    if (now < createWindowStart) {
      return { created: false, reason: "too early" };
    }
  }

  const { gte, lt } = israelDayBounds(nextSession);
  const existing = await prisma.gameSession.findFirst({
    where: { date: { gte, lt } },
    select: { id: true },
  });
  if (existing) {
    return { created: false, reason: "already exists" };
  }

  const session = await prisma.gameSession.create({
    data: { date: nextSession, maxPlayers, isClosed: false },
  });

  const dateStr = nextSession.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  void notifySessionOpen(dateStr, configs);

  return { created: true, sessionId: session.id };
}
