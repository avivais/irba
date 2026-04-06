// Client-safe: pure function, no server imports.
// Renders an admin-editable regulations template into React-renderable data.
//
// Template syntax:
//   ## Heading text        → section heading
//   **bold text**          → inline bold (within a normal line)
//   {variable_name}        → replaced with config value
//   blank line             → paragraph break
//
// Special variable: {session_schedule_day_name} → Hebrew weekday name derived from {session_schedule_day}

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export type RenderedSpan = { type: "text" | "bold"; text: string };
export type RenderedBlock =
  | { type: "heading"; spans: RenderedSpan[] }
  | { type: "paragraph"; spans: RenderedSpan[] };

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
  // Add special derived variable
  const dayNum = parseInt(values["session_schedule_day"] ?? "1", 10);
  const enriched: Record<string, string> = {
    ...values,
    session_schedule_day_name: HEBREW_DAYS[dayNum] ?? HEBREW_DAYS[1],
  };
  return text.replace(/\{(\w+)\}/g, (_, key: string) => enriched[key] ?? `{${key}}`);
}

/**
 * Parse a regulations template string into an array of blocks ready for rendering.
 * Returns an array of RenderedBlock objects (headings and paragraphs).
 */
export function parseRegulationsTemplate(
  template: string,
  configValues: Record<string, string>
): RenderedBlock[] {
  const substituted = substituteVars(template, configValues);
  const rawParagraphs = substituted.split(/\n{2,}/);

  const blocks: RenderedBlock[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Each paragraph is a single line (or may have internal newlines we join)
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];

    if (firstLine.startsWith("## ")) {
      // Heading — render first line as heading, remaining lines (if any) as separate paragraph
      const headingText = firstLine.slice(3).trim();
      blocks.push({ type: "heading", spans: parseSpans(headingText) });
      if (lines.length > 1) {
        const bodyText = lines.slice(1).join("\n");
        blocks.push({ type: "paragraph", spans: parseSpans(bodyText) });
      }
    } else {
      // Paragraph — join all lines with a newline so the component can choose how to render them
      const bodyText = lines.join("\n");
      blocks.push({ type: "paragraph", spans: parseSpans(bodyText) });
    }
  }

  return blocks;
}
