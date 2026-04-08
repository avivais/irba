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

export async function sendWaGroupMessage(groupJid: string, message: string): Promise<void> {
  if (process.env.WA_NOTIFY_ENABLED !== "true") return;
  if (!groupJid) {
    console.warn("[wa-notify] group JID not configured — skipping group message");
    return;
  }
  try {
    const res = await fetch("http://wa:3100/send-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: groupJid, message }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[wa-notify] send-group failed: ${res.status}`);
    }
  } catch (err) {
    console.warn("[wa-notify] send-group error:", err);
  }
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
 * Vars: {date}, {player_name}, {status}
 */
export async function notifyPlayerRegistered(
  dateStr: string,
  playerName: string,
  status: string,
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE], {
    date: dateStr,
    player_name: playerName,
    status,
  });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}

/**
 * Notify the configured WA group that a player has cancelled.
 * Vars: {date}, {player_name}
 */
export async function notifyPlayerCancelled(
  dateStr: string,
  playerName: string,
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE], {
    date: dateStr,
    player_name: playerName,
  });
  await sendWaGroupMessage(configs[CONFIG.WA_GROUP_JID], message);
}

/**
 * Send an individual DM to a player promoted from the waitlist.
 * Vars: {date}, {player_name}
 */
export async function notifyWaitlistPromote(
  phone: string,
  dateStr: string,
  playerName: string,
  configs: Record<ConfigKey, string>,
): Promise<void> {
  if (configs[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_ENABLED] !== "true") return;
  const message = renderTemplate(configs[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE], {
    date: dateStr,
    player_name: playerName,
  });
  await sendWaMessage(phone, message);
}
