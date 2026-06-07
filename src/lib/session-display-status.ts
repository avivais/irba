export type SessionDisplayStatusInput = {
  cancelledAt: Date | null;
  isArchived: boolean;
  isCharged: boolean;
  isClosed: boolean;
};

export type SessionDisplayStatus = {
  label: "בוטל" | "ארכיון" | "חויב" | "לא חויב" | "פתוח";
  tone: "cancelled" | "archived" | "charged" | "closed" | "open";
};

export function getSessionDisplayStatus(
  session: SessionDisplayStatusInput,
): SessionDisplayStatus {
  if (session.cancelledAt) return { label: "בוטל", tone: "cancelled" };
  if (session.isArchived) return { label: "ארכיון", tone: "archived" };
  if (session.isCharged) return { label: "חויב", tone: "charged" };
  if (session.isClosed) return { label: "לא חויב", tone: "closed" };
  return { label: "פתוח", tone: "open" };
}
