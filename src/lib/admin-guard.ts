import { redirect } from "next/navigation";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { prisma } from "@/lib/prisma";

/**
 * Verify the current request is from an authenticated admin player.
 * Redirects to "/" if not authenticated or not an admin.
 * Returns the player ID on success.
 */
export async function requireAdmin(): Promise<string> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) redirect("/");

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { isAdmin: true },
  });
  if (!player?.isAdmin) redirect("/");

  return playerId;
}
