"use client";

import {
  parsePaymentsCsv,
  type ParsedPaymentRow,
  type RowError,
} from "@/lib/csv-import";
import { ImportUploadPage, type PreviewRow } from "@/components/admin/import-upload";
import { importPaymentsAction, type ImportPaymentRow } from "./actions";

function buildPreview(rows: ParsedPaymentRow[], errors: RowError[]): PreviewRow[] {
  const result: PreviewRow[] = rows.map((r) => ({
    valid: true as const,
    label: `${r.nickname} · ${r.date.toLocaleDateString("he-IL")} · ₪${r.amount}`,
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

function toActionRows(rows: ParsedPaymentRow[]): ImportPaymentRow[] {
  return rows.map((r) => ({
    nickname: r.nickname,
    date: r.date.toISOString(),
    amount: r.amount,
  }));
}

export function ImportPaymentsClient() {
  return (
    <ImportUploadPage<ParsedPaymentRow>
      title="ייבוא תשלומים"
      description="העלה CSV רחב: עמודה ראשונה date (YYYY-MM-DD), שאר העמודות הן כינויי שחקנים. כל תא עם ערך יוצר רשומת תשלום. תאים ריקים מדולגים."
      templateHint={`date,אבי,עידן,דימה\n2026-01-05,26,31,\n2026-01-26,26,31,30`}
      parse={parsePaymentsCsv}
      buildPreview={buildPreview}
      onImport={(rows) => importPaymentsAction(toActionRows(rows))}
      backHref="/admin/import"
    />
  );
}
