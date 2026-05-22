import { buildSessionStatus, getNextAssistantSession } from "./session-status";

export type AssistantNextSessionData = {
  session: {
    id: string;
    date: string;
    max_players: number;
    is_closed: boolean;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    registered_count: number;
    confirmed_count: number;
    waitlisted_count: number;
    spots_left: number;
  } | null;
};

export async function getAssistantNextSession(now = new Date()): Promise<AssistantNextSessionData> {
  const session = await getNextAssistantSession(now);
  if (!session) return { session: null };

  const status = await buildSessionStatus(session);

  return {
    session: {
      id: session.id,
      date: session.date.toISOString(),
      max_players: session.maxPlayers,
      is_closed: session.isClosed,
      location_name: session.locationName,
      location_lat: session.locationLat,
      location_lng: session.locationLng,
      registered_count: status.counts.registered,
      confirmed_count: status.counts.confirmed,
      waitlisted_count: status.counts.waitlisted,
      spots_left: status.counts.spots_left,
    },
  };
}
