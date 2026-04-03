export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { autoClosePastSessions } from "@/lib/auto-close-sessions";

/**
 * Idempotent cron endpoint: closes sessions whose end time has passed.
 * Called every minute by an EC2 cron job.
 *
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoClosePastSessions();
  return NextResponse.json(result);
}
