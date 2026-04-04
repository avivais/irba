/**
 * Low-attendance alert system.
 *
 * Checks upcoming open sessions and fires a WhatsApp group message if:
 * - The session is within N hours of starting
 * - The confirmed player count is below minPlayers
 * - The alert hasn't already fired for this session (fire-once via DB flag)
 *
 * Two tiers:
 * - Early: e.g. 48h before start (configurable)
 * - Critical: e.g. 2h before start (configurable)
 *
 * Master toggle: ALERT_LOW_ATTENDANCE_ENABLED must be "true".
 * Each tier also has its own enabled flag.
 */

import type { ConfigKey } from "@/lib/config-keys";
import { CONFIG } from "@/lib/config-keys";
import { renderTemplate, sendWaGroupMessage } from "@/lib/wa-notify";

export type AlertCheckResult = {
  checked: number;
  earlyFired: string[];
  criticalFired: string[];
};

/** Format a session Date as a readable Hebrew date string. */
function formatAlertDate(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Run both alert tiers against all upcoming open sessions.
 * Idempotent: each alert fires at most once per session per tier.
 * Should be called by the /api/cron/auto-close or a dedicated cron endpoint.
 */
export async function checkLowAttendanceAlerts(
  configs: Record<ConfigKey, string>,
): Promise<AlertCheckResult> {
  const masterEnabled = configs[CONFIG.ALERT_LOW_ATTENDANCE_ENABLED] === "true";
  if (!masterEnabled) return { checked: 0, earlyFired: [], criticalFired: [] };

  // Lazy-load prisma to avoid the DATABASE_URL error in test environments
  const { prisma } = await import("@/lib/prisma");

  const minPlayers = parseInt(configs[CONFIG.SESSION_MIN_PLAYERS] ?? "10", 10);
  const now = new Date();

  // Fetch all open sessions in the future that haven't already fired both alerts
  const sessions = await prisma.gameSession.findMany({
    where: {
      isClosed: false,
      isArchived: false,
      date: { gt: now },
    },
    select: {
      id: true,
      date: true,
      alertEarlyFiredAt: true,
      alertCriticalFiredAt: true,
      _count: { select: { attendances: true } },
    },
  });

  const earlyFired: string[] = [];
  const criticalFired: string[] = [];

  for (const session of sessions) {
    const confirmedCount = session._count.attendances;
    if (confirmedCount >= minPlayers) continue; // enough players, no alert needed

    const hoursUntil = (session.date.getTime() - now.getTime()) / (1000 * 60 * 60);
    const dateStr = formatAlertDate(session.date);
    const vars = {
      date: dateStr,
      confirmed: String(confirmedCount),
      min_players: String(minPlayers),
    };

    // ─ Critical alert ────────────────────────────────────────────────────────
    const criticalEnabled = configs[CONFIG.ALERT_CRITICAL_ENABLED] === "true";
    const criticalHours = parseFloat(configs[CONFIG.ALERT_CRITICAL_HOURS_BEFORE] ?? "2");

    if (
      criticalEnabled &&
      !session.alertCriticalFiredAt &&
      hoursUntil <= criticalHours
    ) {
      const template = configs[CONFIG.ALERT_CRITICAL_TEMPLATE];
      const message = renderTemplate(template, vars);
      await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { alertCriticalFiredAt: now },
      });
      criticalFired.push(session.id);
    }

    // ─ Early alert ──────────────────────────────────────────────────────────
    const earlyEnabled = configs[CONFIG.ALERT_EARLY_ENABLED] === "true";
    const earlyHours = parseFloat(configs[CONFIG.ALERT_EARLY_HOURS_BEFORE] ?? "48");

    if (
      earlyEnabled &&
      !session.alertEarlyFiredAt &&
      hoursUntil <= earlyHours
    ) {
      const template = configs[CONFIG.ALERT_EARLY_TEMPLATE];
      const message = renderTemplate(template, vars);
      await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { alertEarlyFiredAt: now },
      });
      earlyFired.push(session.id);
    }
  }

  return { checked: sessions.length, earlyFired, criticalFired };
}
