export type RetroSelectableChange = {
  isFocalPlayer: boolean;
  oldAmount: number;
  newAmount: number;
};

export type RetroSelectableSession<TChange extends RetroSelectableChange> = {
  sessionId: string;
  changes: TChange[];
};

export function selectRetroSessionChanges<
  TChange extends RetroSelectableChange,
  TSession extends RetroSelectableSession<TChange>,
>(sessions: TSession[], selectedSessionIds?: string[]) {
  const selectedIds =
    selectedSessionIds === undefined ? null : new Set(selectedSessionIds);
  const selectedSessions = selectedIds
    ? sessions.filter((session) => selectedIds.has(session.sessionId))
    : sessions;
  const allChanges = selectedSessions.flatMap((session) => session.changes);
  const focalDiff = allChanges
    .filter((change) => change.isFocalPlayer)
    .reduce((sum, change) => sum + change.newAmount - change.oldAmount, 0);
  const othersDiff = allChanges
    .filter((change) => !change.isFocalPlayer)
    .reduce((sum, change) => sum + change.newAmount - change.oldAmount, 0);

  return { selectedSessions, allChanges, focalDiff, othersDiff };
}
