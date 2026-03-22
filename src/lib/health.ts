import { prisma } from "@/lib/prisma";

export type DatabaseHealth = "up" | "down";

/**
 * Lightweight DB connectivity check for load balancers and /api/health.
 * Does not log connection strings or raw driver errors to callers.
 */
export async function checkDatabase(): Promise<{ database: DatabaseHealth }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { database: "up" };
  } catch {
    return { database: "down" };
  }
}
