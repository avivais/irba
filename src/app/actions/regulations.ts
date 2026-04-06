"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { getConfigInt, CONFIG } from "@/lib/config";
import { writeAuditLog } from "@/lib/audit";
import { getClientIpFromHeaders } from "@/lib/rate-limit";

export async function acceptRegulationsAction(): Promise<{ ok: boolean; message?: string }> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) return { ok: false, message: "לא מחובר" };

  const version = await getConfigInt(CONFIG.REGULATIONS_VERSION);

  await prisma.player.update({
    where: { id: playerId },
    data: {
      regulationsAcceptedAt: new Date(),
      regulationsAcceptedVersion: version,
    },
  });

  const headerList = await headers();
  const clientIp = getClientIpFromHeaders((name) => headerList.get(name));

  writeAuditLog({
    actor: playerId,
    actorIp: clientIp,
    action: "PLAYER_ACCEPTED_REGULATIONS",
    entityType: "Player",
    entityId: playerId,
    after: { version },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
