import { checkDatabase } from "@/lib/health";
import { NextResponse } from "next/server";

/**
 * Liveness/readiness probe: verifies PostgreSQL connectivity.
 * Returns generic JSON only — no stack traces or connection details.
 */
export async function GET() {
  const { database } = await checkDatabase();
  if (database === "up") {
    return NextResponse.json({ status: "ok", database: "up" });
  }
  return NextResponse.json(
    { status: "degraded", database: "down" },
    { status: 503 },
  );
}
