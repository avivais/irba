import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import express, { Request, Response } from "express";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { Boom } from "@hapi/boom";

const logger = pino({
  level: "info",
  transport: process.stdout.isTTY
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

const SESSION_PATH = process.env.WA_SESSION_PATH ?? "./session";

// Tracks whether the WA socket is currently connected and ready to send.
let isReady = false;
let sock: ReturnType<typeof makeWASocket> | null = null;

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

async function connectToWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

  sock = makeWASocket({
    auth: state,
    // Suppress Baileys' internal verbose logger — we use pino.
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // we handle QR ourselves
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Scan the QR code below to link WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      isReady = true;
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
        logger.error(
          "Logged out from WhatsApp — delete the session directory and restart to re-link"
        );
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

const PORT = 3100;
app.listen(PORT, () => {
  logger.info({ port: PORT }, "HTTP server listening");
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

connectToWhatsApp().catch((err) => {
  logger.error({ err }, "Initial WhatsApp connection failed");
});
