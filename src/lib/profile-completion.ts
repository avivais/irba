import type { PlayerKind } from "@prisma/client";

export const REGISTERED_REQUIRED_FIELDS = [
  "firstNameHe",
  "lastNameHe",
  "birthdate",
  "nationalId",
  "email",
] as const;

export const DROP_IN_REQUIRED_FIELDS = ["firstNameHe", "lastNameHe"] as const;

export type RequiredProfileField =
  | (typeof REGISTERED_REQUIRED_FIELDS)[number]
  | (typeof DROP_IN_REQUIRED_FIELDS)[number];

export function requiredFieldsFor(
  playerKind: PlayerKind,
): readonly RequiredProfileField[] {
  return playerKind === "REGISTERED"
    ? REGISTERED_REQUIRED_FIELDS
    : DROP_IN_REQUIRED_FIELDS;
}

export type ProfileCompletenessInput = {
  playerKind: PlayerKind;
  firstNameHe: string | null;
  lastNameHe: string | null;
  birthdate: Date | null;
  nationalId: string | null;
  email: string | null;
};

export function isProfileComplete(player: ProfileCompletenessInput): boolean {
  if (player.playerKind === "REGISTERED") {
    return (
      !!player.firstNameHe &&
      !!player.lastNameHe &&
      !!player.birthdate &&
      !!player.nationalId &&
      !!player.email
    );
  }
  return !!player.firstNameHe && !!player.lastNameHe;
}
