export type PlayerLedgerEvent = {
  id: string;
  kind: "PAYMENT" | "SESSION_CHARGE" | "SHARED_EXPENSE_CHARGE";
  effectiveAt: Date;
  createdAt: Date;
  amount: number;
};

export type PlayerLedgerEntry = PlayerLedgerEvent & {
  balanceAfter: number;
};

const KIND_ORDER: Record<PlayerLedgerEvent["kind"], number> = {
  SESSION_CHARGE: 0,
  SHARED_EXPENSE_CHARGE: 1,
  PAYMENT: 2,
};

/**
 * Builds an account-style running balance from oldest to newest.
 * Payments increase the balance; charges decrease it. Effective date is the
 * accounting date, while createdAt and stable identifiers break same-day ties.
 */
export function buildPlayerLedger(
  events: PlayerLedgerEvent[],
): PlayerLedgerEntry[] {
  const ordered = [...events].sort((a, b) => {
    const effectiveDiff = a.effectiveAt.getTime() - b.effectiveAt.getTime();
    if (effectiveDiff !== 0) return effectiveDiff;

    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;

    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kindDiff !== 0) return kindDiff;

    return a.id.localeCompare(b.id);
  });

  let balance = 0;
  return ordered.map((event) => {
    balance += event.kind === "PAYMENT" ? event.amount : -event.amount;
    return { ...event, balanceAfter: balance };
  });
}

export function indexLedgerBalances(
  entries: PlayerLedgerEntry[],
): Map<string, number> {
  return new Map(entries.map((entry) => [`${entry.kind}:${entry.id}`, entry.balanceAfter]));
}
