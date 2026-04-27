import { prisma } from "@/lib/prisma";

export type PruneAuditResult = { deleted: number; cutoff: string };

/**
 * Deletes audit log entries older than `retentionDays`. Idempotent.
 * Default retention is 90 days — surface as `AUDIT_LOG_RETENTION_DAYS` if it
 * ever needs tuning per environment.
 */
export async function pruneAuditLogs(
  retentionDays = 90,
): Promise<PruneAuditResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });
  return { deleted: result.count, cutoff: cutoff.toISOString() };
}
