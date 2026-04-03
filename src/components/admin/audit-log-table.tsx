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

const ACTION_COLORS: Record<string, string> = {
  // Creates — green
  CREATE_PLAYER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_SESSION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_ADJUSTMENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_YEAR_WEIGHT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  CREATE_RATE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  ADD_ATTENDANCE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  RSVP_ATTEND: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  AUTO_CREATE_SESSION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  UPSERT_AGGREGATE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  // Updates — blue
  UPDATE_PLAYER: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_ADJUSTMENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_YEAR_WEIGHT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_RATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UPDATE_CONFIG: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  ARCHIVE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  UNARCHIVE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  OPEN_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  CLOSE_SESSION: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  // Deletes — red
  DELETE_PLAYER: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_SESSION: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_ADJUSTMENT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_YEAR_WEIGHT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_RATE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DELETE_AGGREGATE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  REMOVE_ATTENDANCE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  RSVP_CANCEL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  // Auth — purple
  ADMIN_LOGIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  ADMIN_LOGIN_FAIL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  ADMIN_LOGOUT: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  // Import — indigo
  IMPORT_PLAYERS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  IMPORT_PAYMENTS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  IMPORT_AGGREGATES: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  // System / WA — zinc / teal
  SEND_WA_MESSAGE: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  WA_LOGOUT: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  RUN_AUTO_CREATE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function actionBadgeClass(action: string): string {
  return ACTION_COLORS[action] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function actorLabel(actor: string): { label: string; cls: string } {
  if (actor === "admin") return { label: "admin", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" };
  if (actor === "cron") return { label: "cron", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
  return { label: actor, cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" };
}

function formatTimestamp(iso: string): { absolute: string; date: string; time: string } {
  const d = new Date(iso);
  return {
    absolute: d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
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
            <th className="pb-1 pr-3 text-left font-medium">field</th>
            <th className="pb-1 pr-3 text-left font-medium">before</th>
            <th className="pb-1 text-left font-medium">after</th>
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
          <p className="mb-1 text-xs font-medium text-zinc-400">before</p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {JSON.stringify(before, null, 2)}
          </pre>
        </div>
      )}
      {hasAfter && (
        <div className="flex-1">
          <p className="mb-1 text-xs font-medium text-zinc-400">after</p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {JSON.stringify(after, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { date, time } = formatTimestamp(entry.timestamp);
  const actor = actorLabel(entry.actor);
  const hasDetails = entry.before !== null || entry.after !== null;

  return (
    <>
      <tr
        onClick={hasDetails ? () => setExpanded((v) => !v) : undefined}
        className={`border-b border-zinc-100 transition-colors dark:border-zinc-800 ${hasDetails ? "cursor-pointer" : ""} ${expanded ? "bg-zinc-50 dark:bg-zinc-800/50" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"}`}
      >
        {/* Expand toggle */}
        <td className="w-8 py-2.5 pl-3 pr-1">
          {hasDetails ? (
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-400"
            >
              {expanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />
              }
            </span>
          ) : (
            <span className="flex h-6 w-6 items-center justify-center">
              <span className="h-1 w-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            </span>
          )}
        </td>

        {/* Timestamp */}
        <td className="whitespace-nowrap py-2.5 pr-3 text-right" dir="ltr">
          <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">{time}</span>
          <span className="block text-xs text-zinc-400 dark:text-zinc-500">{date}</span>
        </td>

        {/* Actor */}
        <td className="py-2.5 pr-3" dir="ltr">
          <span className={`inline-block max-w-[12rem] truncate rounded px-1.5 py-0.5 text-xs font-medium ${actor.cls}`}>
            {actor.label}
          </span>
          {entry.actorIp && (
            <span className="mt-0.5 block text-xs text-zinc-400 dark:text-zinc-500">{entry.actorIp}</span>
          )}
        </td>

        {/* Action */}
        <td className="py-2.5 pr-3" dir="ltr">
          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${actionBadgeClass(entry.action)}`}>
            {entry.action}
          </span>
        </td>

        {/* Entity */}
        <td className="py-2.5 pr-3" dir="ltr">
          {entry.entityType && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{entry.entityType}</span>
          )}
          {entry.entityId && (
            <span className="ml-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">{entry.entityId}</span>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
          <td colSpan={5} className="px-4 pb-3 pt-1">
            <JsonDiff before={entry.before} after={entry.after} />
          </td>
        </tr>
      )}
    </>
  );
}

type Props = {
  entries: AuditEntry[];
};

export function AuditLogTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        לא נמצאו רשומות
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-zinc-100 dark:border-zinc-800">
            <th className="w-8 py-2.5 pl-3 pr-1" />
            <th className="py-2.5 pr-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">זמן</th>
            <th className="py-2.5 pr-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">שחקן / מקור</th>
            <th className="py-2.5 pr-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">פעולה</th>
            <th className="py-2.5 pr-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">ישות</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
