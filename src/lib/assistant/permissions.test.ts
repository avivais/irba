import { describe, expect, it } from "vitest";
import { canRunAssistantOperation, isKnownAssistantOperation } from "./permissions";
import type { AssistantActor } from "./types";

const guest: AssistantActor = { level: "guest", player: null, normalizedPhone: null };
const member: AssistantActor = {
  level: "member",
  normalizedPhone: "0501234567",
  player: {
    id: "p1",
    phone: "0501234567",
    nickname: null,
    firstNameHe: null,
    lastNameHe: null,
    isAdmin: false,
  },
};
const admin: AssistantActor = {
  ...member,
  level: "admin",
  player: { ...member.player, isAdmin: true },
};

describe("assistant permissions", () => {
  it("allows guests to call help", () => {
    expect(canRunAssistantOperation(guest, "help")).toBe(true);
  });

  it("keeps member/admin ready for help", () => {
    expect(canRunAssistantOperation(member, "help")).toBe(true);
    expect(canRunAssistantOperation(admin, "help")).toBe(true);
  });

  it("recognizes all known operations including phase 2 mutations", () => {
    expect(isKnownAssistantOperation("help")).toBe(true);
    expect(isKnownAssistantOperation("session_status")).toBe(true);
    expect(isKnownAssistantOperation("next_session")).toBe(true);
    expect(isKnownAssistantOperation("player_register_add")).toBe(true);
    expect(isKnownAssistantOperation("player_register_cancel")).toBe(true);
    expect(isKnownAssistantOperation("player_register_status")).toBe(true);
    expect(isKnownAssistantOperation("session_roster_add")).toBe(true);
    expect(isKnownAssistantOperation("session_roster_remove")).toBe(true);
    expect(isKnownAssistantOperation("roster.add")).toBe(false);
  });

  it("allows all actor levels to call read-only operations", () => {
    for (const operation of ["help", "session_status", "next_session"]) {
      expect(canRunAssistantOperation(guest, operation)).toBe(true);
      expect(canRunAssistantOperation(member, operation)).toBe(true);
      expect(canRunAssistantOperation(admin, operation)).toBe(true);
    }
    expect(canRunAssistantOperation(admin, "roster.add")).toBe(false);
  });

  it("denies guest actor from calling admin-only mutation ops", () => {
    expect(canRunAssistantOperation(guest, "session_roster_add")).toBe(false);
    expect(canRunAssistantOperation(guest, "session_roster_remove")).toBe(false);
  });

  it("allows known members and admins, but not guests, to call self-service RSVP ops", () => {
    for (const operation of ["player_register_add", "player_register_cancel", "player_register_status"]) {
      expect(canRunAssistantOperation(guest, operation)).toBe(false);
      expect(canRunAssistantOperation(member, operation)).toBe(true);
      expect(canRunAssistantOperation(admin, operation)).toBe(true);
    }
  });

  it("denies member actor from calling admin-only mutation ops", () => {
    expect(canRunAssistantOperation(member, "session_roster_add")).toBe(false);
    expect(canRunAssistantOperation(member, "session_roster_remove")).toBe(false);
  });

  it("allows admin actor to call mutation ops", () => {
    expect(canRunAssistantOperation(admin, "session_roster_add")).toBe(true);
    expect(canRunAssistantOperation(admin, "session_roster_remove")).toBe(true);
  });
});
