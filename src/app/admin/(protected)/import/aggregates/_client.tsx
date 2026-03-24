"use client";

import {
  parseAggregatesCsv,
  type ParsedAggregateRow,
  type RowError,
} from "@/lib/csv-import";
import { ImportUploadPage, type PreviewRow } from "@/components/admin/import-upload";
import { importAggregatesAction, type ImportAggregateRow } from "./actions";

function buildPreview(rows: ParsedAggregateRow[], errors: RowError[]): PreviewRow[] {
  const result: PreviewRow[] = rows.map((r) => ({
    valid: true as const,
    label: `${r.nickname} · ${r.year} · ${r.count} מפגשים`,
  }));
  for (const e of errors) {
    result.splice(e.rowIndex - 1, 0, {
      valid: false as const,
      label: `שורה ${e.rowIndex}`,
      error: e.message,
    });
  }
  return result;
}

function toActionRows(rows: ParsedAggregateRow[]): ImportAggregateRow[] {
  return rows.map((r) => ({ nickname: r.nickname, year: r.year, count: r.count }));
}

export function ImportAggregatesClient() {
  return (
    <ImportUploadPage<ParsedAggregateRow>
      title="ייבוא נוכחות עבר"
      description="העלה CSV רחב: עמודה ראשונה nickname, שאר העמודות הן שנים. ערך בכל תא = מספר מפגשים. תאים ריקים מדולגים. שנת הנוכחות החיה לא תיובא."
      templateHint={`nickname,2021,2022,2023,2024,2025\nאבי,10,15,12,18,20\nעידן,8,0,14,9,11`}
      parse={parseAggregatesCsv}
      buildPreview={buildPreview}
      onImport={(rows) => importAggregatesAction(toActionRows(rows))}
      backHref="/admin/import"
    />
  );
}
