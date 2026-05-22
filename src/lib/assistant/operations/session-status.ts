import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sortAttendancesByPrecedence } from "@/lib/sort-attendances";
import type { PlayerKind, Prisma } from "@prisma/client";

const sessionStatusParamsSchema = z
  .object({
    target: z.literal("next").optional().default("next"),
    include_waitlist: z.boolean().optional().default(true),
    include_registered_list: z.boolean().optional().default(true),
  })
  .strict();

type AssistantSession = Prisma.GameSessionGetPayload<{
  include: { attendances: { include: { player: true } } };
}>;

type SortedAttendance = AssistantSession["attendances"][number];

export type AssistantRosterPlayer = {
  position: number;
  player_id: string;
  display_name: string;
  player_kind: PlayerKind;
};

export type AssistantSessionStatusData = {
  session: {
    id: string;
    date: string;
    max_players: number;
    is_closed: boolean;
    is_cancelled: boolean;
    location_name: string | null;
  } | null;
  counts: {
    registered: number;
    confirmed: number;
    waitlisted: number;
    spots_left: number;
  };
  confirmed: AssistantRosterPlayer[];
  waitlist: AssistantRosterPlayer[];
};

export async function getAssistantSessionStatus(
  params: unknown,
  now = new Date(),
): Promise<AssistantSessionStatusData> {
  const parsed = sessionStatusParamsSchema.parse(params ?? {});

  const session = await getNextAssistantSession(now);
  const status = await buildSessionStatus(session);
  return {
    ...status,
    confirmed: parsed.include_registered_list ? status.confirmed : [],
    waitlist: parsed.include_waitlist ? status.waitlist : [],
  };
}

export async function getNextAssistantSession(now = new Date()): Promise<AssistantSession | null> {
  return prisma.gameSession.findFirst({
    where: {
      date: { gte: now },
      isArchived: false,
      cancelledAt: null,
    },
    orderBy: { date: "asc" },
    include: {
      attendances: {
        include: { player: true },
      },
    },
  });
}

export async function buildSessionStatus(session: AssistantSession | null): Promise<AssistantSessionStatusData> {
  if (!session) {
    return {
      session: null,
      counts: { registered: 0, confirmed: 0, waitlisted: 0, spots_left: 0 },
      confirmed: [],
      waitlist: [],
    };
  }

  const sorted = await sortAttendancesByPrecedence(session.attendances, session.date.getFullYear());
  const confirmedAttendances = sorted.slice(0, session.maxPlayers);
  const waitlistAttendances = sorted.slice(session.maxPlayers);
  const spotsLeft = Math.max(session.maxPlayers - confirmedAttendances.length, 0);

  return {
    session: {
      id: session.id,
      date: session.date.toISOString(),
      max_players: session.maxPlayers,
      is_closed: session.isClosed,
      is_cancelled: Boolean(session.cancelledAt),
      location_name: session.locationName,
    },
    counts: {
      registered: sorted.length,
      confirmed: confirmedAttendances.length,
      waitlisted: waitlistAttendances.length,
      spots_left: spotsLeft,
    },
    confirmed: toRosterPlayers(confirmedAttendances),
    waitlist: toRosterPlayers(waitlistAttendances),
  };
}

function toRosterPlayers(attendances: SortedAttendance[]): AssistantRosterPlayer[] {
  return attendances.map((attendance, index) => ({
    position: index + 1,
    player_id: attendance.player.id,
    display_name: getSafeAssistantDisplayName(attendance.player),
    player_kind: attendance.player.playerKind,
  }));
}

export function getSafeAssistantDisplayName(player: {
  nickname?: string | null;
  firstNameHe?: string | null;
  lastNameHe?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  name?: string | null;
}): string {
  const nickname = player.nickname?.trim();
  if (nickname) return nickname;

  const hebrewName = [player.firstNameHe, player.lastNameHe]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (hebrewName) return hebrewName;

  const storedName = player.name?.trim();
  if (storedName) return storedName;

  const englishName = [player.firstNameEn, player.lastNameEn]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (englishName) return englishName;

  return "שחקן";
}
