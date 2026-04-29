import type { PlayerKind } from "@prisma/client";

export const REQUIRED_PROFILE_FIELDS = [
  "firstNameHe",
  "lastNameHe",
  "birthdate",
  "nationalId",
  "email",
] as const;

export type ProfileCompletenessInput = {
  playerKind: PlayerKind;
  firstNameHe: string | null;
  lastNameHe: string | null;
  birthdate: Date | null;
  nationalId: string | null;
  email: string | null;
};

export function isProfileComplete(player: ProfileCompletenessInput): boolean {
  if (player.playerKind !== "REGISTERED") return true;
  return (
    !!player.firstNameHe &&
    !!player.lastNameHe &&
    !!player.birthdate &&
    !!player.nationalId &&
    !!player.email
  );
}
