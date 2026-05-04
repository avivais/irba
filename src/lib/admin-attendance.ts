import { prisma } from "@/lib/prisma";

/**
 * Auto-attend the admin(s) on a freshly-created session. The admin runs every
 * session, so they should appear on every roster (and be charged) like any
 * other registered player. If the admin actually skips a session they can
 * remove themselves manually from the session detail page.
 *
 * Idempotent: skips if an Attendance row already exists for the (admin, session)
 * pair. Errors are swallowed — session creation must not fail because of this.
 */
export async function addAdminAttendances(sessionId: string): Promise<void> {
  const admins = await prisma.player.findMany({
    where: { isAdmin: true },
    select: { id: true },
  });
  if (admins.length === 0) return;
  for (const admin of admins) {
    try {
      await prisma.attendance.create({
        data: { playerId: admin.id, gameSessionId: sessionId },
      });
    } catch {
      // unique-constraint violation — already attending; ignore
    }
  }
}
