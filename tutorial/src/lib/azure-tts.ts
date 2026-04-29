import { writeFileSync } from "node:fs";

type TtsOptions = {
  /** Hebrew text. Plain text or pre-baked SSML inline tags (`<say-as>`, `<lang>`, etc.) — wrapped in <speak><voice> by this helper. */
  text: string;
  voice?: string;
  region?: string;
  apiKey?: string;
  /** Output path; if absent, returns the audio buffer. */
  outputPath?: string;
};

const DEFAULT_VOICE = "en-US-Davis:DragonHDLatestNeural";

function escapeForSsml(text: string): string {
  // We allow SSML tags inside the script (e.g. <say-as>, <lang>) so don't escape
  // angle brackets. Just normalise smart quotes and ampersands so the engine
  // doesn't choke on entity boundaries.
  return text.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
}

function buildSsml(text: string, voice: string): string {
  return `<speak version="1.0" xml:lang="he-IL"><voice name="${voice}">${escapeForSsml(text)}</voice></speak>`;
}

export async function synthesise(opts: TtsOptions): Promise<Buffer> {
  const apiKey = opts.apiKey ?? process.env.AZURE_SPEECH_KEY;
  const region = opts.region ?? process.env.AZURE_SPEECH_REGION ?? "eastus";
  const voice = opts.voice ?? process.env.AZURE_VOICE ?? DEFAULT_VOICE;
  if (!apiKey) throw new Error("AZURE_SPEECH_KEY missing — see tutorial/.env.local");

  const ssml = buildSsml(opts.text, voice);
  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
        "User-Agent": "irba-tutorial",
      },
      body: ssml,
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable>");
    throw new Error(`Azure TTS HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  if (opts.outputPath) writeFileSync(opts.outputPath, buf);
  return buf;
}
