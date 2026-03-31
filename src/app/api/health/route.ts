export const dynamic = "force-dynamic";

import { checkDatabase } from "@/lib/health";
import { NextResponse } from "next/server";

/**
 * Liveness/readiness probe: verifies PostgreSQL connectivity.
 * Returns generic JSON only — no stack traces or connection details.
 */
export async function GET() {
  const { database } = await checkDatabase();
  const version = process.env.NEXT_PUBLIC_COMMIT_HASH ?? "dev";
  const commitDate = process.env.NEXT_PUBLIC_COMMIT_DATE ?? null;
  if (database === "up") {
    return NextResponse.json({ status: "ok", database: "up", version, commitDate });
  }
  return NextResponse.json(
    { status: "degraded", database: "down" },
    { status: 503 },
  );
}
