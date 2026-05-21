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

  it("recognizes only implemented operations in phase 0", () => {
    expect(isKnownAssistantOperation("help")).toBe(true);
    expect(isKnownAssistantOperation("roster.add")).toBe(false);
    expect(canRunAssistantOperation(admin, "roster.add")).toBe(false);
  });
});
