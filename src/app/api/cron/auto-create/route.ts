export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { autoCreateNextSession } from "@/lib/auto-create-session";

/**
 * Idempotent cron endpoint: creates the next scheduled session when it's time.
 * Called hourly by an EC2 cron job.
 *
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoCreateNextSession();
  return NextResponse.json(result);
}
