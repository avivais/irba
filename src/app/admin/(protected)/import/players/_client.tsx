"use client";

import {
  parsePlayersCsv,
  type ParsedPlayerRow,
  type RowError,
} from "@/lib/csv-import";
import { ImportUploadPage, type PreviewRow } from "@/components/admin/import-upload";
import {
  importPlayersAction,
  checkPlayerConflictsAction,
  type ImportPlayerRow,
} from "./actions";

function buildPreview(rows: ParsedPlayerRow[], errors: RowError[]): PreviewRow[] {
  const result: PreviewRow[] = rows.map((r) => ({
    valid: true as const,
    label: `${r.nickname}${r.phone ? ` · ${r.phone}` : ""}${r.playerKind === "REGISTERED" ? " · קבוע" : " · מזדמן"}`,
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

function toActionRows(rows: ParsedPlayerRow[]): ImportPlayerRow[] {
  return rows.map((r) => ({
    ...r,
    birthdate: r.birthdate ? r.birthdate.toISOString() : null,
    positions: r.positions,
  }));
}

async function checkConflicts(rows: ParsedPlayerRow[]) {
  return checkPlayerConflictsAction(
    rows.map((r) => ({ nickname: r.nickname, phone: r.phone })),
  );
}

export function ImportPlayersClient() {
  return (
    <ImportUploadPage<ParsedPlayerRow>
      title="ייבוא שחקנים"
      description='העלה קובץ CSV עם רשימת שחקנים. העמודה nickname נדרשת (מפתח התאמה). שחקן עם טלפון ייווצר אם לא קיים, יעודכן אם קיים. עמדות מרובות — עטוף במרכאות: "PG,SG".'
      templateHint={`nickname,firstNameHe,lastNameHe,firstNameEn,lastNameEn,phone,birthdate,playerKind,positions\nאבי,אבי,כהן,Avi,Cohen,0521234567,1990-05-15,REGISTERED,"PG,SG"`}
      parse={parsePlayersCsv}
      buildPreview={buildPreview}
      onImport={(rows) => importPlayersAction(toActionRows(rows))}
      checkConflicts={checkConflicts}
      backHref="/admin/import"
    />
  );
}
