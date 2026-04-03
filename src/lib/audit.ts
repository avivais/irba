import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "ADMIN_LOGIN"
  | "ADMIN_LOGIN_FAIL"
  | "ADMIN_LOGOUT"
  | "CREATE_PLAYER"
  | "UPDATE_PLAYER"
  | "DELETE_PLAYER"
  | "CREATE_SESSION"
  | "UPDATE_SESSION"
  | "DELETE_SESSION"
  | "ARCHIVE_SESSION"
  | "UNARCHIVE_SESSION"
  | "OPEN_SESSION"
  | "CLOSE_SESSION"
  | "ADD_ATTENDANCE"
  | "REMOVE_ATTENDANCE"
  | "RSVP_ATTEND"
  | "RSVP_CANCEL"
  | "CREATE_ADJUSTMENT"
  | "UPDATE_ADJUSTMENT"
  | "DELETE_ADJUSTMENT"
  | "UPSERT_AGGREGATE"
  | "DELETE_AGGREGATE"
  | "CREATE_YEAR_WEIGHT"
  | "UPDATE_YEAR_WEIGHT"
  | "DELETE_YEAR_WEIGHT"
  | "UPDATE_CONFIG"
  | "CREATE_RATE"
  | "UPDATE_RATE"
  | "DELETE_RATE"
  | "IMPORT_PLAYERS"
  | "IMPORT_PAYMENTS"
  | "IMPORT_AGGREGATES"
  | "SEND_WA_MESSAGE"
  | "WA_LOGOUT"
  | "RUN_AUTO_CREATE"
  | "AUTO_CREATE_SESSION"
  | "PLAYER_LOGIN"
  | "PLAYER_LOGIN_FAIL"
  | "PLAYER_LOGOUT"
  | "PLAYER_OTP_SENT"
  | "PLAYER_OTP_VERIFIED"
  | "PLAYER_PASSWORD_SET"
  | "PLAYER_PASSWORD_RESET";

export type AuditParams = {
  actor: string;
  actorIp?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
};

/** Fire-and-forget — never throws, never blocks the caller. */
export function writeAuditLog(params: AuditParams): void {
  void prisma.auditLog
    .create({
      data: {
        actor: params.actor,
        actorIp: params.actorIp ?? null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        before: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch((e: unknown) => {
      console.error("[audit] write failed", e);
    });
}
