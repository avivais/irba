import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import express, { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";
import pino from "pino";
import QRCode from "qrcode";
import qrcode from "qrcode-terminal";
import { Boom } from "@hapi/boom";

const logger = pino({
  level: "info",
  transport: process.stdout.isTTY
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

// Don't let a stray rejection (Baileys cleanup, fs error, etc.) crashloop the
// container — the docker restart policy keeps respawning and the bot never
// gets to the QR-emit phase.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
});

const SESSION_PATH = process.env.WA_SESSION_PATH ?? "./session";

// Tracks whether the WA socket is currently connected and ready to send.
let isReady = false;
let sock: ReturnType<typeof makeWASocket> | null = null;
// Latest QR code as a data URL (null when not pending or already scanned).
let currentQr: string | null = null;

/**
 * Normalise an Israeli phone number to the JID format expected by Baileys.
 * "0501234567" → "972501234567@s.whatsapp.net"
 */
function toJid(phone: string): string {
  const stripped = phone.replace(/\D/g, "");
  const normalised = stripped.startsWith("0")
    ? "972" + stripped.slice(1)
    : stripped;
  return `${normalised}@s.whatsapp.net`;
}

/**
 * Wipe the on-disk auth state and re-bootstrap the socket so Baileys emits a
 * fresh QR. Used both on explicit /logout and when WhatsApp invalidates the
 * session (DisconnectReason.loggedOut) — without this auto-recovery, the bot
 * stays disconnected with no QR until an operator SSHes in.
 */
/**
 * Empty the contents of SESSION_PATH without removing the directory itself.
 * SESSION_PATH is a docker bind-mount — `fs.rm(SESSION_PATH, …)` on the mount
 * point fails with EBUSY. Wipe each child entry individually instead.
 */
async function clearSessionDir(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(SESSION_PATH);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  await Promise.all(
    entries.map((entry) =>
      fs.rm(path.join(SESSION_PATH, entry), { recursive: true, force: true }),
    ),
  );
}

async function resetSession(): Promise<void> {
  isReady = false;
  currentQr = null;
  try {
    await sock?.logout();
  } catch {
    // ignore — socket may already be dead
  }
  sock = null;
  try {
    await clearSessionDir();
    logger.info("Session cleared — reconnecting for new QR");
  } catch (err) {
    logger.error({ err }, "Failed to clear session dir — attempting reconnect anyway");
  }
  connectToWhatsApp().catch((err) =>
    logger.error({ err }, "Reconnect after reset failed"),
  );
}

async function connectToWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    // Suppress Baileys' internal verbose logger — we use pino.
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // we handle QR ourselves
    browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Scan the QR code below to link WhatsApp:");
      qrcode.generate(qr, { small: true });
      QRCode.toDataURL(qr).then((dataUrl) => {
        currentQr = dataUrl;
      }).catch(() => {});
    }

    if (connection === "open") {
      isReady = true;
      currentQr = null;
      logger.info("WhatsApp connection established");
    }

    if (connection === "close") {
      isReady = false;
      const boom = lastDisconnect?.error as Boom | undefined;
      const statusCode = boom?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { statusCode, shouldReconnect },
        "WhatsApp connection closed"
      );

      if (shouldReconnect) {
        logger.info("Reconnecting to WhatsApp…");
        // Delay slightly to avoid tight reconnect loops.
        setTimeout(() => {
          connectToWhatsApp().catch((err) =>
            logger.error({ err }, "Reconnect failed")
          );
        }, 3000);
      } else {
        logger.warn("Logged out from WhatsApp — clearing session and re-pairing");
        setTimeout(() => {
          resetSession().catch((err) =>
            logger.error({ err }, "Auto-reset after loggedOut failed"),
          );
        }, 1000);
      }
    }
  });
}

// ── Express HTTP server ──────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/status", (_req: Request, res: Response) => {
  res.json({ ready: isReady });
});

interface SendBody {
  to?: unknown;
  message?: unknown;
}

app.post("/send", async (req: Request<object, object, SendBody>, res: Response) => {
  const { to, message } = req.body;

  if (typeof to !== "string" || typeof message !== "string") {
    res.status(400).json({ error: "to and message are required strings" });
    return;
  }

  if (!isReady || sock === null) {
    logger.warn({ to }, "Send attempted while not ready");
    res.status(503).json({ error: "WhatsApp not connected" });
    return;
  }

  const jid = toJid(to);
  logger.info({ to, jid }, "Sending WhatsApp message");

  try {
    await sock.sendMessage(jid, { text: message });
    logger.info({ to, jid }, "Message sent successfully");
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err, to, jid }, "Failed to send message");
    res.status(503).json({ error: "Send failed" });
  }
});

interface SendGroupBody {
  groupId?: unknown;
  message?: unknown;
}

app.post("/send-group", async (req: Request<object, object, SendGroupBody>, res: Response) => {
  const { groupId, message } = req.body;

  if (typeof groupId !== "string" || typeof message !== "string") {
    res.status(400).json({ error: "groupId and message are required strings" });
    return;
  }

  if (!isReady || sock === null) {
    logger.warn({ groupId }, "Send-group attempted while not ready");
    res.status(503).json({ error: "WhatsApp not connected" });
    return;
  }

  logger.info({ groupId }, "Sending WhatsApp group message");

  try {
    await sock.sendMessage(groupId, { text: message });
    logger.info({ groupId }, "Group message sent successfully");
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err, groupId }, "Failed to send group message");
    res.status(503).json({ error: "Send failed" });
  }
});

app.get("/qr", (_req: Request, res: Response) => {
  res.json({ qr: currentQr });
});

app.post("/logout", async (_req: Request, res: Response) => {
  await resetSession();
  res.json({ ok: true });
});

interface SendPollBody {
  groupId?: unknown;
  question?: unknown;
  options?: unknown;
}

app.post("/send-poll", async (req: Request<object, object, SendPollBody>, res: Response) => {
  const { groupId, question, options } = req.body;

  if (
    typeof groupId !== "string" ||
    typeof question !== "string" ||
    !Array.isArray(options) ||
    options.some((o) => typeof o !== "string")
  ) {
    res.status(400).json({ error: "groupId, question, and options (string[]) are required" });
    return;
  }

  if (!isReady || sock === null) {
    logger.warn({ groupId }, "Send-poll attempted while not ready");
    res.status(503).json({ error: "WhatsApp not connected" });
    return;
  }

  logger.info({ groupId, question }, "Sending WhatsApp poll");

  try {
    await sock.sendMessage(groupId, {
      poll: { name: question, values: options as string[], selectableCount: 1 },
    });
    logger.info({ groupId }, "Poll sent successfully");
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err, groupId }, "Failed to send poll");
    res.status(503).json({ error: "Send failed" });
  }
});

app.get("/groups", async (_req: Request, res: Response) => {
  if (!isReady || sock === null) {
    res.status(503).json({ error: "WhatsApp not connected" });
    return;
  }

  try {
    const groups = await sock.groupFetchAllParticipating();
    const list = Object.entries(groups).map(([id, meta]) => ({
      id,
      subject: meta.subject,
    }));
    res.status(200).json(list);
  } catch (err) {
    logger.error({ err }, "Failed to fetch groups");
    res.status(503).json({ error: "Failed to fetch groups" });
  }
});

const PORT = 3100;
app.listen(PORT, () => {
  logger.info({ port: PORT }, "HTTP server listening");
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

connectToWhatsApp().catch((err) => {
  logger.error({ err }, "Initial WhatsApp connection failed");
});
