import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "לוג פעולות" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 75;

const ENTITY_TYPES = [
  "Player",
  "GameSession",
  "Attendance",
  "PlayerAdjustment",
  "PlayerYearAggregate",
  "YearWeight",
  "AppConfig",
  "HourlyRate",
  "Payment",
];

const ACTIONS = [
  "ADMIN_LOGIN", "ADMIN_LOGIN_FAIL", "ADMIN_LOGOUT",
  "PLAYER_LOGIN", "PLAYER_LOGIN_FAIL", "PLAYER_LOGOUT",
  "PLAYER_OTP_SENT", "PLAYER_OTP_VERIFIED",
  "PLAYER_PASSWORD_SET", "PLAYER_PASSWORD_CHANGE", "PLAYER_PASSWORD_RESET",
  "PLAYER_CREATED_SELF", "PLAYER_NAME_SET", "PLAYER_ACCEPTED_REGULATIONS",
  "CREATE_PLAYER", "UPDATE_PLAYER", "DELETE_PLAYER",
  "CREATE_SESSION", "UPDATE_SESSION", "DELETE_SESSION",
  "ARCHIVE_SESSION", "UNARCHIVE_SESSION", "OPEN_SESSION", "CLOSE_SESSION",
  "ADD_ATTENDANCE", "REMOVE_ATTENDANCE",
  "RSVP_ATTEND", "RSVP_CANCEL",
  "CREATE_ADJUSTMENT", "UPDATE_ADJUSTMENT", "DELETE_ADJUSTMENT",
  "UPSERT_AGGREGATE", "DELETE_AGGREGATE",
  "CREATE_YEAR_WEIGHT", "UPDATE_YEAR_WEIGHT", "DELETE_YEAR_WEIGHT",
  "UPDATE_CONFIG",
  "CREATE_RATE", "UPDATE_RATE", "DELETE_RATE",
  "CHARGE_SESSION", "UNCHARGE_SESSION", "UPDATE_SESSION_CHARGE", "CASCADE_RECALC",
  "ADD_PAYMENT", "DELETE_PAYMENT",
  "CREATE_MATCH", "UPDATE_MATCH", "DELETE_MATCH",
  "IMPORT_PLAYERS", "IMPORT_PAYMENTS", "IMPORT_AGGREGATES",
  "SEND_WA_MESSAGE", "WA_LOGOUT", "RUN_AUTO_CREATE", "AUTO_CREATE_SESSION",
];

type SearchParams = {
  page?: string;
  action?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
  q?: string;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.entity ? { entityType: sp.entity } : {}),
    ...(sp.actor ? { actor: { contains: sp.actor, mode: "insensitive" } } : {}),
    ...((sp.from || sp.to) ? {
      timestamp: {
        ...(sp.from ? { gte: new Date(sp.from) } : {}),
        ...(sp.to ? { lte: new Date(sp.to + "T23:59:59.999Z") } : {}),
      },
    } : {}),
    ...(sp.q ? {
      OR: [
        { entityId: { contains: sp.q, mode: "insensitive" } },
        { actor: { contains: sp.q, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Resolve player IDs → display names (for actor and entityId columns)
  // Collect cuid-shaped values that need resolution
  const CUID_RE = /^c[a-z0-9]{20,}$/;
  const playerIdSet = new Set<string>();
  for (const e of entries) {
    if (CUID_RE.test(e.actor)) playerIdSet.add(e.actor);
    if (e.entityType === "Player" && e.entityId) playerIdSet.add(e.entityId);
    if (e.entityType === "GameSession" && e.entityId) {/* resolved below */}
  }
  const sessionIdSet = new Set<string>();
  for (const e of entries) {
    if (e.entityType === "GameSession" && e.entityId) sessionIdSet.add(e.entityId);
  }

  const [playerRows, sessionRows] = await Promise.all([
    playerIdSet.size > 0
      ? prisma.player.findMany({
          where: { id: { in: Array.from(playerIdSet) } },
          select: { id: true, phone: true, nickname: true, firstNameHe: true, lastNameHe: true },
        })
      : [],
    sessionIdSet.size > 0
      ? prisma.gameSession.findMany({
          where: { id: { in: Array.from(sessionIdSet) } },
          select: { id: true, date: true },
        })
      : [],
  ]);

  const playerNames: Record<string, string> = {};
  for (const p of playerRows) {
    const display = p.nickname ?? (p.firstNameHe ? `${p.firstNameHe} ${p.lastNameHe ?? ""}`.trim() : p.phone);
    playerNames[p.id] = display;
  }
  const sessionNames: Record<string, string> = {};
  for (const s of sessionRows) {
    sessionNames[s.id] = s.date.toLocaleDateString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  }

  // Serialize for client component (Dates → strings)
  const serialized = entries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp.toISOString(),
    actor: e.actor,
    actorIp: e.actorIp,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    before: e.before,
    after: e.after,
  }));

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (sp.action) params.set("action", sp.action);
    if (sp.entity) params.set("entity", sp.entity);
    if (sp.actor) params.set("actor", sp.actor);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.q) params.set("q", sp.q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = !!(sp.action || sp.entity || sp.actor || sp.from || sp.to || sp.q);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
          >
            → חזרה
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            <ClipboardList className="h-5 w-5" aria-hidden />
            לוג פעולות
          </h1>
        </div>
        <span className="text-sm text-zinc-500 dark:text-zinc-400" dir="ltr">
          {total.toLocaleString()} רשומות
        </span>
      </header>

      {/* Filters */}
      <form
        method="GET"
        className="mx-auto mt-5 w-full max-w-5xl flex flex-wrap items-end gap-3"
      >
        {/* Action */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">פעולה</label>
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            dir="ltr"
          >
            <option value="">הכל</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Entity type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">סוג ישות</label>
          <select
            name="entity"
            defaultValue={sp.entity ?? ""}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            dir="ltr"
          >
            <option value="">הכל</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Actor */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">שחקן / מקור</label>
          <input
            name="actor"
            type="text"
            defaultValue={sp.actor ?? ""}
            placeholder="admin, phone, cron…"
            dir="ltr"
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 w-40"
          />
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">מתאריך</label>
          <input
            name="from"
            type="date"
            defaultValue={sp.from ?? ""}
            dir="ltr"
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">עד תאריך</label>
          <input
            name="to"
            type="date"
            defaultValue={sp.to ?? ""}
            dir="ltr"
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Free text / entity ID search */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">חיפוש חופשי</label>
          <input
            name="q"
            type="text"
            defaultValue={sp.q ?? ""}
            placeholder="מזהה ישות, טלפון…"
            dir="ltr"
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 w-44"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          חפש
        </button>
        {hasFilters && (
          <Link
            href="/admin/audit"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            נקה
          </Link>
        )}
      </form>

      {/* Table */}
      <section className="mx-auto mt-4 w-full max-w-5xl">
        <AuditLogTable entries={serialized} playerNames={playerNames} sessionNames={sessionNames} />
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mx-auto mt-4 flex w-full max-w-5xl items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={pageUrl(page - 1)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ← הקודם
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageUrl(page + 1)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                הבא →
              </Link>
            )}
          </div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400" dir="ltr">
            עמוד {page} מתוך {totalPages}
          </span>
        </nav>
      )}
    </div>
  );
}
