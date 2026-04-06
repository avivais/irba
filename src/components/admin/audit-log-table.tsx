"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type AuditEntry = {
  id: number;
  timestamp: string;
  actor: string;
  actorIp: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
};

// Human-readable Hebrew labels for each action
const ACTION_LABELS: Record<string, string> = {
  // Auth — admin
  ADMIN_LOGIN: "כניסת מנהל",
  ADMIN_LOGIN_FAIL: "כניסת מנהל נכשלה",
  ADMIN_LOGOUT: "יציאת מנהל",
  // Auth — player
  PLAYER_LOGIN: "כניסת שחקן",
  PLAYER_LOGIN_FAIL: "כניסת שחקן נכשלה",
  PLAYER_LOGOUT: "יציאת שחקן",
  PLAYER_OTP_SENT: "קוד OTP נשלח",
  PLAYER_OTP_VERIFIED: "קוד OTP אומת",
  PLAYER_PASSWORD_SET: "סיסמה הוגדרה",
  PLAYER_PASSWORD_CHANGE: "סיסמה שונתה",
  PLAYER_PASSWORD_RESET: "סיסמה אופסה",
  PLAYER_CREATED_SELF: "שחקן נרשם בעצמו",
  PLAYER_NAME_SET: "שם שחקן נקבע",
  PLAYER_ACCEPTED_REGULATIONS: "תקנון אושר",
  // Players
  CREATE_PLAYER: "שחקן נוצר",
  UPDATE_PLAYER: "שחקן עודכן",
  DELETE_PLAYER: "שחקן נמחק",
  // Sessions
  CREATE_SESSION: "מפגש נוצר",
  UPDATE_SESSION: "מפגש עודכן",
  DELETE_SESSION: "מפגש נמחק",
  ARCHIVE_SESSION: "מפגש הועבר לארכיון",
  UNARCHIVE_SESSION: "מפגש הוצא מארכיון",
  OPEN_SESSION: "מפגש נפתח",
  CLOSE_SESSION: "מפגש נסגר",
  // Attendance
  ADD_ATTENDANCE: "שחקן נוסף למפגש",
  REMOVE_ATTENDANCE: "שחקן הוסר ממפגש",
  RSVP_ATTEND: "הרשמה למפגש",
  RSVP_CANCEL: "ביטול הרשמה",
  // Finance
  ADD_PAYMENT: "תשלום נוסף",
  DELETE_PAYMENT: "תשלום נמחק",
  CHARGE_SESSION: "מפגש חויב",
  UNCHARGE_SESSION: "חיוב מפגש בוטל",
  UPDATE_SESSION_CHARGE: "חיוב שחקן עודכן",
  CASCADE_RECALC: "חישוב מחדש רצף חיובים",
  // Matches
  CREATE_MATCH: "משחק נוצר",
  UPDATE_MATCH: "משחק עודכן",
  DELETE_MATCH: "משחק נמחק",
  // Precedence
  CREATE_ADJUSTMENT: "התאמת עדיפות נוצרה",
  UPDATE_ADJUSTMENT: "התאמת עדיפות עודכנה",
  DELETE_ADJUSTMENT: "התאמת עדיפות נמחקה",
  UPSERT_AGGREGATE: "נתון היסטורי עודכן",
  DELETE_AGGREGATE: "נתון היסטורי נמחק",
  CREATE_YEAR_WEIGHT: "משקל שנה נוצר",
  UPDATE_YEAR_WEIGHT: "משקל שנה עודכן",
  DELETE_YEAR_WEIGHT: "משקל שנה נמחק",
  // Config
  UPDATE_CONFIG: "הגדרות עודכנו",
  CREATE_RATE: "תעריף נוצר",
  UPDATE_RATE: "תעריף עודכן",
  DELETE_RATE: "תעריף נמחק",
  // Import
  IMPORT_PLAYERS: "ייבוא שחקנים",
  IMPORT_PAYMENTS: "ייבוא תשלומים",
  IMPORT_AGGREGATES: "ייבוא נתונים היסטוריים",
  // System / WA
  SEND_WA_MESSAGE: "הודעת וואטסאפ נשלחה",
  WA_LOGOUT: "התנתקות וואטסאפ",
  RUN_AUTO_CREATE: "הרצת יצירה אוטומטית",
  AUTO_CREATE_SESSION: "מפגש נוצר אוטומטית",
};

// Hebrew entity type labels
const ENTITY_LABELS: Record<string, string> = {
  Player: "שחקן",
  GameSession: "מפגש",
  Attendance: "הרשמה",
  PlayerAdjustment: "התאמת עדיפות",
  PlayerYearAggregate: "נתון היסטורי",
  YearWeight: "משקל שנה",
  AppConfig: "הגדרות",
  HourlyRate: "תעריף",
  Payment: "תשלום",
  SessionCharge: "חיוב",
  Match: "משחק",
};

const ACTION_COLORS: Record<string, string> = {
  // Creates — green
  CREATE_PLAYER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_SESSION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_ADJUSTMENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_YEAR_WEIGHT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_RATE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_MATCH: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  ADD_ATTENDANCE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  ADD_PAYMENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  RSVP_ATTEND: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  AUTO_CREATE_SESSION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  UPSERT_AGGREGATE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  PLAYER_CREATED_SELF: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  // Updates — blue
  UPDATE_PLAYER: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_ADJUSTMENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_YEAR_WEIGHT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_RATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_MATCH: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_CONFIG: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_SESSION_CHARGE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  CASCADE_RECALC: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  ARCHIVE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UNARCHIVE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  OPEN_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  CLOSE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  PLAYER_NAME_SET: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  PLAYER_ACCEPTED_REGULATIONS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  // Deletes / cancels — red
  DELETE_PLAYER: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_SESSION: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_ADJUSTMENT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_YEAR_WEIGHT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_RATE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_MATCH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_AGGREGATE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_PAYMENT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  REMOVE_ATTENDANCE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  RSVP_CANCEL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  UNCHARGE_SESSION: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  // Auth — purple / violet / amber
  ADMIN_LOGIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  ADMIN_LOGIN_FAIL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  ADMIN_LOGOUT: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  PLAYER_LOGIN: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  PLAYER_LOGIN_FAIL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  PLAYER_LOGOUT: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  PLAYER_OTP_SENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  PLAYER_OTP_VERIFIED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  PLAYER_PASSWORD_SET: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  PLAYER_PASSWORD_CHANGE: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  PLAYER_PASSWORD_RESET: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  // Finance — teal
  CHARGE_SESSION: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  // Import — indigo
  IMPORT_PLAYERS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  IMPORT_PAYMENTS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  IMPORT_AGGREGATES: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  // System / WA — zinc
  SEND_WA_MESSAGE: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  WA_LOGOUT: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  RUN_AUTO_CREATE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function actionBadgeClass(action: string): string {
  return ACTION_COLORS[action] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function actorDisplay(actor: string, playerNames: Record<string, string>): { label: string; sub?: string; cls: string } {
  if (actor === "admin") return { label: "מנהל", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" };
  if (actor === "cron") return { label: "מערכת", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
  // Resolved player ID → name
  if (playerNames[actor]) return { label: playerNames[actor], sub: actor.slice(-6), cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" };
  // Phone number (already human-readable)
  return { label: actor, cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" };
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

function JsonDiff({ before, after }: { before: unknown; after: unknown }) {
  const hasBefore = before !== null && before !== undefined;
  const hasAfter = after !== null && after !== undefined;

  if (!hasBefore && !hasAfter) return <p className="text-xs text-zinc-400">אין פרטים</p>;

  if (hasBefore && hasAfter && typeof before === "object" && typeof after === "object") {
    const allKeys = new Set([...Object.keys(before as object), ...Object.keys(after as object)]);
    const rows = Array.from(allKeys).map((k) => {
      const b = (before as Record<string, unknown>)[k];
      const a = (after as Record<string, unknown>)[k];
      const changed = JSON.stringify(b) !== JSON.stringify(a);
      return { k, b, a, changed };
    });

    return (
      <table className="w-full text-xs" dir="ltr">
        <thead>
          <tr className="text-zinc-400">
            <th className="pb-1 pr-3 text-left font-medium">שדה</th>
            <th className="pb-1 pr-3 text-left font-medium">לפני</th>
            <th className="pb-1 text-left font-medium">אחרי</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ k, b, a, changed }) => (
            <tr key={k} className={changed ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
              <td className="py-0.5 pr-3 font-mono text-zinc-500 dark:text-zinc-400">{k}</td>
              <td className={`py-0.5 pr-3 font-mono ${changed ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                {b === undefined ? <span className="opacity-40">—</span> : JSON.stringify(b)}
              </td>
              <td className={`py-0.5 font-mono ${changed ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                {a === undefined ? <span className="opacity-40">—</span> : JSON.stringify(a)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="flex gap-4">
      {hasBefore && (
        <div className="flex-1">
          <p className="mb-1 text-xs font-medium text-zinc-400">לפני</p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {JSON.stringify(before, null, 2)}
          </pre>
        </div>
      )}
      {hasAfter && (
        <div className="flex-1">
          <p className="mb-1 text-xs font-medium text-zinc-400">אחרי</p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {JSON.stringify(after, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function AuditRow({
  entry,
  playerNames,
  sessionNames,
}: {
  entry: AuditEntry;
  playerNames: Record<string, string>;
  sessionNames: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { date, time } = formatTimestamp(entry.timestamp);
  const actor = actorDisplay(entry.actor, playerNames);
  const hasDetails = entry.before !== null || entry.after !== null;

  // Resolve entity display
  const entityTypeLabel = entry.entityType ? (ENTITY_LABELS[entry.entityType] ?? entry.entityType) : null;
  let entityIdLabel: string | null = null;
  if (entry.entityId) {
    if (entry.entityType === "Player" && playerNames[entry.entityId]) {
      entityIdLabel = playerNames[entry.entityId];
    } else if (entry.entityType === "GameSession" && sessionNames[entry.entityId]) {
      entityIdLabel = sessionNames[entry.entityId];
    } else if (entry.entityId.length > 12) {
      // Truncate long cuids — show last 6 chars
      entityIdLabel = "…" + entry.entityId.slice(-6);
    } else {
      entityIdLabel = entry.entityId;
    }
  }

  const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;

  return (
    <>
      <tr
        onClick={hasDetails ? () => setExpanded((v) => !v) : undefined}
        className={`border-b border-zinc-100 transition-colors dark:border-zinc-800 ${hasDetails ? "cursor-pointer" : ""} ${expanded ? "bg-zinc-50 dark:bg-zinc-800/50" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"}`}
      >
        {/* Expand toggle */}
        <td className="w-8 py-2.5 pl-3 pr-1">
          {hasDetails ? (
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded text-zinc-400">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          ) : (
            <span className="flex h-6 w-6 items-center justify-center">
              <span className="h-1 w-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            </span>
          )}
        </td>

        {/* Timestamp */}
        <td className="whitespace-nowrap py-2 pr-2 text-right sm:py-2.5 sm:pr-3" dir="ltr">
          <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">{time}</span>
          <span className="block text-xs text-zinc-400 dark:text-zinc-500">{date}</span>
        </td>

        {/* Actor */}
        <td className="py-2 pr-2 sm:py-2.5 sm:pr-3">
          <span className={`inline-block max-w-[8rem] truncate rounded px-1.5 py-0.5 text-xs font-medium sm:max-w-[12rem] ${actor.cls}`}>
            {actor.label}
          </span>
          {entry.actorIp && (
            <span className="mt-0.5 hidden text-xs text-zinc-400 sm:block dark:text-zinc-500" dir="ltr">{entry.actorIp}</span>
          )}
        </td>

        {/* Action — Hebrew label */}
        <td className="py-2 pr-2 sm:py-2.5 sm:pr-3">
          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${actionBadgeClass(entry.action)}`}>
            {actionLabel}
          </span>
        </td>

        {/* Entity — resolved name + type label */}
        <td className="hidden py-2.5 pr-3 sm:table-cell">
          {entityTypeLabel && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{entityTypeLabel}</span>
          )}
          {entityIdLabel && (
            <span className="mr-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">{entityIdLabel}</span>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
          <td colSpan={5} className="px-4 pb-3 pt-1">
            <div className="overflow-x-auto">
              <JsonDiff before={entry.before} after={entry.after} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

type Props = {
  entries: AuditEntry[];
  playerNames: Record<string, string>;
  sessionNames: Record<string, string>;
};

export function AuditLogTable({ entries, playerNames, sessionNames }: Props) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        לא נמצאו רשומות
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-100 dark:border-zinc-800">
            <th className="w-8 py-2.5 pl-3 pr-1" />
            <th className="py-2.5 pr-2 text-right text-xs font-medium text-zinc-500 sm:pr-3 dark:text-zinc-400">זמן</th>
            <th className="py-2.5 pr-2 text-right text-xs font-medium text-zinc-500 sm:pr-3 dark:text-zinc-400">מבצע</th>
            <th className="py-2.5 pr-2 text-right text-xs font-medium text-zinc-500 sm:pr-3 dark:text-zinc-400">פעולה</th>
            <th className="hidden py-2.5 pr-3 text-right text-xs font-medium text-zinc-500 sm:table-cell dark:text-zinc-400">על מה</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} playerNames={playerNames} sessionNames={sessionNames} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
