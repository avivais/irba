export const dynamic = "force-dynamic";

import { checkDatabase } from "@/lib/health";
import { NextResponse } from "next/server";

async function checkWaBot(): Promise<"up" | "down"> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch("http://wa:3100/status", { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return "down";
    const body = (await res.json()) as { ready?: boolean };
    return body.ready ? "up" : "down";
  } catch {
    return "down";
  }
}

/**
 * Liveness/readiness probe: verifies PostgreSQL + WhatsApp sidecar connectivity.
 * Returns generic JSON only — no stack traces or connection details.
 */
export async function GET() {
  const [{ database }, wa] = await Promise.all([checkDatabase(), checkWaBot()]);
  const version = process.env.NEXT_PUBLIC_COMMIT_HASH ?? "dev";
  const commitDate = process.env.NEXT_PUBLIC_COMMIT_DATE ?? null;
  if (database === "up") {
    return NextResponse.json({ status: "ok", database: "up", wa, version, commitDate });
  }
  return NextResponse.json(
    { status: "degraded", database: "down", wa },
    { status: 503 },
  );
}
