import { prisma } from "@/lib/prisma";
import { normalizePhone, PhoneValidationError } from "@/lib/phone";
import type { AssistantActor, PlayerSummary } from "./types";

export function normalizeAssistantPhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("972") && digits.length === 12) {
    return normalizePhone(`0${digits.slice(3)}`);
  }

  return normalizePhone(digits);
}

export async function resolveAssistantActor(
  actorPhone: string,
): Promise<AssistantActor> {
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeAssistantPhone(actorPhone);
  } catch (error) {
    if (error instanceof PhoneValidationError) {
      return { level: "guest", player: null, normalizedPhone: null };
    }
    throw error;
  }

  const player = await prisma.player.findUnique({
    where: { phone: normalizedPhone },
    select: {
      id: true,
      phone: true,
      nickname: true,
      firstNameHe: true,
      lastNameHe: true,
      isAdmin: true,
    },
  });

  if (!player) {
    return { level: "guest", player: null, normalizedPhone };
  }

  const summary: PlayerSummary = player;
  return {
    level: summary.isAdmin ? "admin" : "member",
    player: summary,
    normalizedPhone,
  };
}
