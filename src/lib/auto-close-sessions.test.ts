import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  getAllConfigs: vi.fn(),
  notifySessionClose: vi.fn(),
  writeAuditLog: vi.fn(),
  checkLowAttendanceAlerts: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gameSession: {
      findMany: mocks.findMany,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config-keys")>("@/lib/config-keys");
  return {
    CONFIG: actual.CONFIG,
    getAllConfigs: mocks.getAllConfigs,
  };
});

vi.mock("@/lib/wa-notify", () => ({
  notifySessionClose: mocks.notifySessionClose,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/low-attendance-alert", () => ({
  checkLowAttendanceAlerts: mocks.checkLowAttendanceAlerts,
}));

import { autoClosePastSessions } from "./auto-close-sessions";

describe("autoClosePastSessions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T18:00:00.000Z"));
    vi.clearAllMocks();
    mocks.getAllConfigs.mockResolvedValue({});
    mocks.checkLowAttendanceAlerts.mockResolvedValue({ earlyFired: [], criticalFired: [] });
  });

  it("closes registration as soon as the session start time has passed", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "past-start", date: new Date("2026-05-26T17:59:00.000Z") },
      { id: "future-start", date: new Date("2026-05-26T18:01:00.000Z") },
    ]);

    const result = await autoClosePastSessions();

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "past-start" },
      data: { isClosed: true },
    });
    expect(result.closed).toEqual(["past-start"]);
    expect(result.skipped).toBe(1);
  });
});
