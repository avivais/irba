export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { pruneAuditLogs } from "@/lib/audit-prune";

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

  const retentionDays = parseRetention(process.env.AUDIT_LOG_RETENTION_DAYS);
  const result = await pruneAuditLogs(retentionDays);
  return NextResponse.json(result);
}

function parseRetention(raw: string | undefined): number {
  if (!raw) return 90;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 3650) return 90;
  return n;
}
