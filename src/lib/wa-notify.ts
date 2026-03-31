/**
 * Best-effort WhatsApp notification client.
 * POSTs to the wa sidecar service (http://wa:3100/send).
 * No-ops when WA_NOTIFY_ENABLED !== "true".
 * Never throws — errors are logged and swallowed.
 */
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
