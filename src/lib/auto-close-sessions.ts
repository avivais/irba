import { prisma } from "@/lib/prisma";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { notifySessionClose } from "@/lib/wa-notify";
import { writeAuditLog } from "@/lib/audit";

export type AutoCloseResult = {
  closed: string[];
  skipped: number;
};

/**
 * Idempotent: closes all sessions whose end time (date + duration) has passed.
 * Called by the /api/cron/auto-close endpoint every minute.
 */
export async function autoClosePastSessions(): Promise<AutoCloseResult> {
  const configs = await getAllConfigs();
  const defaultDuration = parseInt(configs[CONFIG.SESSION_DEFAULT_DURATION_MIN], 10);
  const now = new Date();

  const openSessions = await prisma.gameSession.findMany({
    where: { isClosed: false, isArchived: false },
    select: { id: true, date: true, durationMinutes: true },
  });

  const closed: string[] = [];
  let skipped = 0;

  for (const session of openSessions) {
    const duration = session.durationMinutes ?? defaultDuration;
    const endTime = new Date(session.date.getTime() + duration * 60 * 1000);

    if (endTime > now) {
      skipped++;
      continue;
    }

    await prisma.gameSession.update({
      where: { id: session.id },
      data: { isClosed: true },
    });

    writeAuditLog({
      actor: "cron",
      action: "CLOSE_SESSION",
      entityType: "GameSession",
      entityId: session.id,
      after: { reason: "auto_close" },
    });

    const dateStr = session.date.toLocaleDateString("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    await notifySessionClose(dateStr, configs);

    closed.push(session.id);
  }

  return { closed, skipped };
}
