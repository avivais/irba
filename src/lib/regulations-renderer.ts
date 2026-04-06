// Client-safe: pure function, no server imports.
// Renders an admin-editable regulations template into React-renderable data.
//
// Template syntax:
//   ## Heading text        → section heading (h3)
//   ### Sub-heading        → sub-heading (h4)
//   **bold text**          → inline bold
//   - item text            → bullet list item (consecutive - lines form one list block)
//   {variable_name}        → replaced with config value
//   blank line             → paragraph break
//
// Special variable: {session_schedule_day_name} → Hebrew weekday name derived from {session_schedule_day}

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export type RenderedSpan = { type: "text" | "bold"; text: string };
export type RenderedBlock =
  | { type: "heading"; spans: RenderedSpan[] }
  | { type: "subheading"; spans: RenderedSpan[] }
  | { type: "paragraph"; spans: RenderedSpan[] }
  | { type: "list"; items: RenderedSpan[][] };

/** Parse inline `**bold**` spans within a single line of text. */
function parseSpans(line: string): RenderedSpan[] {
  const spans: RenderedSpan[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      spans.push({ type: "text", text: line.slice(last, match.index) });
    }
    spans.push({ type: "bold", text: match[1] });
    last = match.index + match[0].length;
  }
  if (last < line.length) {
    spans.push({ type: "text", text: line.slice(last) });
  }
  return spans;
}

/** Substitute {variable} placeholders with values from the config map. */
function substituteVars(text: string, values: Record<string, string>): string {
  const dayNum = parseInt(values["session_schedule_day"] ?? "1", 10);
  const enriched: Record<string, string> = {
    ...values,
    session_schedule_day_name: HEBREW_DAYS[dayNum] ?? HEBREW_DAYS[1],
  };
  return text.replace(/\{(\w+)\}/g, (_, key: string) => enriched[key] ?? `{${key}}`);
}

/**
 * Parse a regulations template string into an array of blocks ready for rendering.
 */
export function parseRegulationsTemplate(
  template: string,
  configValues: Record<string, string>
): RenderedBlock[] {
  const substituted = substituteVars(template, configValues);

  // Work line-by-line so we can group consecutive bullet lines into a list block
  const lines = substituted.split("\n");
  const blocks: RenderedBlock[] = [];
  let pendingBullets: RenderedSpan[][] = [];
  let pendingParagraphLines: string[] = [];

  function flushBullets() {
    if (pendingBullets.length > 0) {
      blocks.push({ type: "list", items: pendingBullets });
      pendingBullets = [];
    }
  }

  function flushParagraph() {
    const text = pendingParagraphLines.join("\n").trim();
    if (text) {
      blocks.push({ type: "paragraph", spans: parseSpans(text) });
    }
    pendingParagraphLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("## ")) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: "heading", spans: parseSpans(line.slice(3).trim()) });
    } else if (line.startsWith("### ")) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: "subheading", spans: parseSpans(line.slice(4).trim()) });
    } else if (/^- /.test(line)) {
      flushParagraph();
      pendingBullets.push(parseSpans(line.slice(2).trim()));
    } else if (line.trim() === "") {
      // Blank line — flush paragraph accumulator; bullets only flush on non-bullet content
      flushParagraph();
      flushBullets();
    } else {
      // Regular text line — flush any pending bullets first
      flushBullets();
      pendingParagraphLines.push(line);
    }
  }

  flushParagraph();
  flushBullets();

  return blocks;
}
