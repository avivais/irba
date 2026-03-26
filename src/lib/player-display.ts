export function getPlayerDisplayName(player: {
  firstNameHe?: string | null;
  lastNameHe?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  nickname?: string | null;
  phone?: string;
}): string {
  if (player.firstNameHe || player.lastNameHe) {
    return [player.firstNameHe, player.lastNameHe].filter(Boolean).join(" ");
  }
  if (player.firstNameEn || player.lastNameEn) {
    return [player.firstNameEn, player.lastNameEn].filter(Boolean).join(" ");
  }
  if (player.nickname) return player.nickname;
  return player.phone ?? "שחקן";
}
