export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
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

/**
 * Idempotent cron endpoint: creates the next scheduled session when it's time.
 * Called hourly by an EC2 cron job.
 *
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // 1. Auth
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check schedule enabled
  const configs = await getAllConfigs();
  if (configs[CONFIG.SESSION_SCHEDULE_ENABLED] !== "true") {
    return NextResponse.json({ created: false, reason: "schedule disabled" });
  }

  // 3. Read schedule params
  const scheduleDayOfWeek = parseInt(configs[CONFIG.SESSION_SCHEDULE_DAY], 10);
  const scheduleTime = configs[CONFIG.SESSION_SCHEDULE_TIME];
  const hoursBeforeCreate = parseInt(configs[CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE], 10);
  const maxPlayers = 15; // matches GameSession schema default

  // 4. Compute next session datetime
  const now = new Date();
  const nextSession = nextScheduledSession(scheduleDayOfWeek, scheduleTime, now);

  // 5. Check if it's time to create (within the lead window)
  const createWindowStart = new Date(nextSession.getTime() - hoursBeforeCreate * 3_600_000);
  if (now < createWindowStart) {
    return NextResponse.json({ created: false, reason: "too early" });
  }

  // 6. Check if a session already exists for that day
  const { gte, lt } = israelDayBounds(nextSession);
  const existing = await prisma.gameSession.findFirst({
    where: { date: { gte, lt } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ created: false, reason: "already exists", sessionId: existing.id });
  }

  // 7. Create the session (open for RSVP)
  const session = await prisma.gameSession.create({
    data: {
      date: nextSession,
      maxPlayers,
      isClosed: false,
    },
  });

  // 8. Notify the WA group that the session is open (best-effort, non-blocking)
  const dateStr = nextSession.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  void notifySessionOpen(dateStr, configs);

  return NextResponse.json({ created: true, sessionId: session.id });
}
