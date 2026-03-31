/**
 * Pure helper for waitlist promotion logic.
 * No Prisma dependency — safe to import in tests.
 */

export interface AttendanceStub {
  id: string;
  createdAt: Date;
}

/**
 * Compute the new `createdAt` timestamp that would place the target attendance
 * at the last confirmed slot (i.e. 1 ms before the current last-confirmed record).
 *
 * Returns `null` when the operation is not applicable:
 *  - `attendances` is empty
 *  - `targetId` is not found
 *  - the target is already in the confirmed portion (index < maxPlayers)
 *  - there are no confirmed attendances (maxPlayers === 0 or list is shorter)
 */
export function computePromoteTimestamp(
  attendances: AttendanceStub[],
  maxPlayers: number,
  targetId: string,
): Date | null {
  if (attendances.length === 0) return null;

  const targetIndex = attendances.findIndex((a) => a.id === targetId);
  if (targetIndex === -1) return null;

  // Target must be in the waitlist portion
  if (targetIndex < maxPlayers) return null;

  // There must be at least one confirmed attendance
  const lastConfirmedIndex = maxPlayers - 1;
  if (lastConfirmedIndex < 0) return null;

  const lastConfirmed = attendances[lastConfirmedIndex];
  return new Date(lastConfirmed.createdAt.getTime() - 1);
}
