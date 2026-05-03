/**
 * WhatsApp notification client.
 *
 * Low-level primitives: sendWaMessage (individual DM), sendWaGroupMessage (group broadcast).
 * High-level dispatchers: notifySession*, notifyPlayer* — read AppConfig, render templates,
 * route to the right recipient. All functions are best-effort and never throw.
 *
 * Master kill switch: WA_NOTIFY_ENABLED env var must be "true" or all functions no-op.
 */

import type { ConfigKey } from "@/lib/config-keys";
import { CONFIG } from "@/lib/config-keys";

// ── Low-level primitives ─────────────────────────────────────────────────────

export async function sendWaMessage(phone: string, message: string): Promise<void> {
  if (process.env.WA_NOTIFY_ENABLED !== "true") return;
  try {
    const res = await fetch("http://wa:3100/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, message }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[wa-notify] send failed: ${res.status}`);
    }
  } catch (err) {
    console.warn("[wa-notify] send error:", err);
  }
}

export async function sendWaGroupMessage(
  groupJid: string,
  message: string,
  mentions?: string[],
): Promise<void> {
  if (process.env.WA_NOTIFY_ENABLED !== "true") return;
  if (!groupJid) {
    console.warn("[wa-notify] group JID not configured — skipping group message");
    return;
  }
  try {
    const res = await fetch("http://wa:3100/send-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: groupJid,
        message,
        ...(mentions && mentions.length > 0 ? { mentions } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[wa-notify] send-group failed: ${res.status}`);
    }
  } catch (err) {
    console.warn("[wa-notify] send-group error:", err);
  }
}

/**
 * Convert a normalised Israeli mobile (`05XXXXXXXX`) to a WhatsApp E.164-style
 * identifier. Two forms returned:
 *  - `digits`  → `972XXXXXXXXX`        (used inline in message text as `@{digits}`)
 *  - `jid`     → `972XXXXXXXXX@s.whatsapp.net` (passed to Baileys `mentions: []`)
 *
 * Returns `null` if the phone doesn't match the expected `05XXXXXXXX` format —
 * caller should skip tagging that participant rather than crashing.
 */
export function phoneToWaMention(phone: string): { digits: string; jid: string } | null {
  if (!/^05\d{8}$/.test(phone)) return null;
  const digits = "972" + phone.slice(1);
  return { digits, jid: `${digits}@s.whatsapp.net` };
}

export async function sendWaPoll(
  groupJid: string,
  question: string,
  options: string[],
): Promise<void> {
  if (process.env.WA_NOTIFY_ENABLED !== "true") return;
  if (!groupJid) {
    console.warn("[wa-notify] group JID not configured — skipping poll");
    return;
  }
  try {
    const res = await fetch("http://wa:3100/send-poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: groupJid, question, options }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[wa-notify] send-poll failed: ${res.status}`);
    }
  } catch (err) {
    console.warn("[wa-notify] send-poll error:", err);
  }
}

// ── Template renderer ────────────────────────────────────────────────────────

/**
 * Replace {key} placeholders in a template string.
 * Unknown placeholders are left as-is so typos don't silently erase content.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

// ── High-level notification dispatchers ─────────────────────────────────────

export interface WaSessionOpenOverride {
  enabled?: boolean;
  template?: string;
}

/**
 * Notify the configured WA group that a session has opened for registration.
 * Vars: {date}
 */
export async function notifySessionOpen(
  dateStr: string,
  configs: Record<ConfigKey, string>,
  override?: WaSessionOpenOverride,
): Promise<void> {
  const enabled = override?.enabled ?? configs[CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED] === "true";
  if (!enabled) return;
  const template = override?.template || configs[CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE];
  const message = renderTemplate(template, { date: dateStr });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}

/**
 * Notify the configured WA group that a session has been closed.
 * Vars: {date}
 */
export async function notifySessionClose(
  dateStr: string,
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_SESSION_CLOSE_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_SESSION_CLOSE_TEMPLATE], { date: dateStr });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}

/**
 * Notify the configured WA group that a player has registered.
 * Vars: {date}, {player_name}, {status}, {registered_list}, {waitlist}
 */
export async function notifyPlayerRegistered(
  dateStr: string,
  playerName: string,
  status: string,
  registeredList: string[],
  waitlist: string[],
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE], {
    date: dateStr,
    player_name: playerName,
    status,
    registered_list: registeredList.join("\n"),
    waitlist: waitlist.join("\n"),
  });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}

/**
 * Notify the configured WA group that a player has cancelled.
 * Vars: {date}, {player_name}, {registered_list}, {waitlist}
 */
export async function notifyPlayerCancelled(
  dateStr: string,
  playerName: string,
  registeredList: string[],
  waitlist: string[],
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE], {
    date: dateStr,
    player_name: playerName,
    registered_list: registeredList.join("\n"),
    waitlist: waitlist.join("\n"),
  });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}

/**
 * Notify the configured WA group that a competition round has ended and announce the winner.
 * Vars: {player_name}, {round_number}
 */
export async function notifyCompetitionWinner(
  playerName: string,
  roundNumber: number,
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_COMPETITION_WINNER_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_COMPETITION_WINNER_TEMPLATE], {
    player_name: playerName,
    round_number: String(roundNumber),
  });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}

/**
 * Send an individual DM to a player promoted from the waitlist.
 * Vars: {date}, {player_name}, {registered_list}, {waitlist}
 */
export async function notifyWaitlistPromote(
  phone: string,
  dateStr: string,
  playerName: string,
  registeredList: string[],
  waitlist: string[],
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE], {
    date: dateStr,
    player_name: playerName,
    registered_list: registeredList.join("\n"),
    waitlist: waitlist.join("\n"),
  });
  await sendWaMessage(phone, message);
}

export type DebtorEntry = {
  name: string;
  phone: string;
  amount: number; // positive ILS owed (i.e. abs(balance))
};

/**
 * Manually broadcast a debt reminder to the configured WA group.
 * Used by the "send debt reminder" admin button on the finance page.
 *
 * Tagging: when `wa_notify_debtors_tag_enabled = "true"`, each debtor's WA
 * mention (`@972…`) is appended to their line in the rendered list AND the
 * full JID is passed to Baileys via `mentions[]` so WhatsApp actually fires
 * a notification. Phones that don't match `05XXXXXXXX` (e.g. landlines,
 * malformed) are silently skipped (their line shows name+amount only).
 *
 * Vars: {debtors_list}, {count}
 */
export async function notifyDebtors(
  debtors: DebtorEntry[],
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_DEBTORS_ENABLED] !== "true") return;
  const tagEnabled = configs[CONFIG.WA_NOTIFY_DEBTORS_TAG_ENABLED] === "true";

  const lines: string[] = [];
  const mentions: string[] = [];
  for (const d of debtors) {
    const tag = tagEnabled ? phoneToWaMention(d.phone) : null;
    if (tag) {
      lines.push(`${d.name} @${tag.digits} — ₪${d.amount}`);
      mentions.push(tag.jid);
    } else {
      lines.push(`${d.name} — ₪${d.amount}`);
    }
  }

  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_DEBTORS_TEMPLATE], {
    debtors_list: lines.join("\n"),
    count: String(debtors.length),
  });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message, mentions);
}

/**
 * Manually broadcast the current session roster to the configured WA group.
 * Used by the "send roster update" admin button.
 * Vars: {date}, {registered_list}, {waitlist}
 */
export async function notifySessionRoster(
  dateStr: string,
  registeredList: string[],
  waitlist: string[],
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_SESSION_ROSTER_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_SESSION_ROSTER_TEMPLATE], {
    date: dateStr,
    registered_list: registeredList.join("\n"),
    waitlist: waitlist.join("\n"),
  });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}
