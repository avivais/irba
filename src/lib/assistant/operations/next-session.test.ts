import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session-status", () => ({
  getNextAssistantSession: vi.fn(),
  buildSessionStatus: vi.fn(),
}));

import { buildSessionStatus, getNextAssistantSession } from "./session-status";
import { getAssistantNextSession } from "./next-session";

const now = new Date("2026-05-22T09:00:00.000Z");

function session(overrides = {}) {
  return {
    id: "s1",
    date: new Date("2026-05-23T17:00:00.000Z"),
    maxPlayers: 15,
    isClosed: false,
    locationName: "אילן רמון",
    locationLat: 32.1,
    locationLng: 34.8,
    ...overrides,
  };
}

describe("getAssistantNextSession", () => {
  beforeEach(() => {
    vi.mocked(getNextAssistantSession).mockReset();
    vi.mocked(buildSessionStatus).mockReset();
  });

  it("returns null when there is no upcoming session", async () => {
    vi.mocked(getNextAssistantSession).mockResolvedValue(null);

    await expect(getAssistantNextSession(now)).resolves.toEqual({ session: null });
  });

  it("returns next session metadata and roster counts", async () => {
    const next = session();
    vi.mocked(getNextAssistantSession).mockResolvedValue(next as never);
    vi.mocked(buildSessionStatus).mockResolvedValue({
      session: {
        id: "s1",
        date: "2026-05-23T17:00:00.000Z",
        max_players: 15,
        is_closed: false,
        is_cancelled: false,
        location_name: "אילן רמון",
      },
      counts: { registered: 12, confirmed: 12, waitlisted: 0, spots_left: 3 },
      confirmed: [],
      waitlist: [],
    });

    const result = await getAssistantNextSession(now);

    expect(getNextAssistantSession).toHaveBeenCalledWith(now);
    expect(result).toEqual({
      session: {
        id: "s1",
        date: "2026-05-23T17:00:00.000Z",
        max_players: 15,
        is_closed: false,
        location_name: "אילן רמון",
        location_lat: 32.1,
        location_lng: 34.8,
        registered_count: 12,
        confirmed_count: 12,
        waitlisted_count: 0,
        spots_left: 3,
      },
    });
  });
});
