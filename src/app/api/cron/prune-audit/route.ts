export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { pruneAssistantRequestLogs, pruneAuditLogs } from "@/lib/audit-prune";
import { getConfigValue, CONFIG } from "@/lib/config";

/**
 * Idempotent cron endpoint: deletes audit log rows older than the configured
 * retention. Called daily by an EC2 cron job.
 *
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionDays = parseRetention(process.env.AUDIT_LOG_RETENTION_DAYS, 90);
  const assistantRetentionDays = parseRetention(
    await getConfigValue(CONFIG.ASSISTANT_LOG_RETENTION_DAYS),
    7,
  );
  const [audit, assistant] = await Promise.all([
    pruneAuditLogs(retentionDays),
    pruneAssistantRequestLogs(assistantRetentionDays),
  ]);
  return NextResponse.json({ ...audit, ...assistant });
}

function parseRetention(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 3650) return fallback;
  return n;
}
