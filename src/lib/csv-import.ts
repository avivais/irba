import { normalizePhone, PhoneValidationError } from "./phone";
import { POSITION_VALUES, type PositionValue } from "./player-validation";

export type RowError = { rowIndex: number; message: string };

export type ParseResult<T> = {
  rows: T[];
  errors: RowError[];
};

// ---------------------------------------------------------------------------
// Date parsing — supports YYYY-MM-DD and Israeli D.M.YY / D.M.YYYY
// ---------------------------------------------------------------------------

function parseBirthdate(raw: string): Date | null {
  const trimmed = raw.trim();

  // Israeli format: D.M.YY or D.M.YYYY
  const israeliMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (israeliMatch) {
    const day = parseInt(israeliMatch[1], 10);
    const month = parseInt(israeliMatch[2], 10) - 1;
    let year = parseInt(israeliMatch[3], 10);
    if (year < 100) year += year <= 30 ? 2000 : 1900;
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
    return null;
  }

  // ISO / other formats parseable by Date constructor
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Shared CSV parser — RFC 4180, handles quoted fields (e.g. "PG,SG,SF")
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) { fields.push(""); break; }
    if (line[i] === '"') {
      // Quoted field
      i++;
      let f = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { f += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { f += line[i++]; }
      }
      fields.push(f.trim());
      if (i < line.length && line[i] === ',') i++;
    } else {
      // Unquoted field
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i).trim()); break; }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

function parseCsvText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines.map(parseCsvLine);
}

// ---------------------------------------------------------------------------
// Players CSV
// ---------------------------------------------------------------------------

export type ParsedPlayerRow = {
  nickname: string;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  phone: string | null;
  birthdate: Date | null;
  playerKind: "REGISTERED" | "DROP_IN";
  positions: PositionValue[];
};

export function parsePlayersCsv(text: string): ParseResult<ParsedPlayerRow> {
  const rows: ParsedPlayerRow[] = [];
  const errors: RowError[] = [];

  const lines = parseCsvText(text).filter((r) => r.some((c) => c !== ""));
  if (lines.length === 0) return { rows, errors };

  const header = lines[0].map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const nicknameIdx = col("nickname");
  if (nicknameIdx === -1) {
    errors.push({ rowIndex: 0, message: "חסרה עמודת nickname" });
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    const get = (idx: number) => (idx !== -1 && idx < cells.length ? cells[idx].trim() : "");

    const nickname = get(nicknameIdx);
    if (!nickname) {
      errors.push({ rowIndex: i, message: "nickname ריק" });
      continue;
    }

    // Phone — optional but validated if present
    let phone: string | null = null;
    const rawPhone = get(col("phone"));
    if (rawPhone) {
      try {
        phone = normalizePhone(rawPhone);
      } catch (e) {
        if (e instanceof PhoneValidationError) {
          errors.push({ rowIndex: i, message: `מספר טלפון לא תקין: ${rawPhone}` });
          continue;
        }
        throw e;
      }
    }

    // Birthdate — optional
    let birthdate: Date | null = null;
    const rawBirthdate = get(col("birthdate"));
    if (rawBirthdate) {
      const d = parseBirthdate(rawBirthdate);
      if (!d) {
        errors.push({ rowIndex: i, message: `תאריך לידה לא תקין: ${rawBirthdate}` });
        continue;
      }
      birthdate = d;
    }

    // PlayerKind — default DROP_IN
    const rawKind = get(col("playerkind")).toUpperCase();
    const playerKind: "REGISTERED" | "DROP_IN" =
      rawKind === "REGISTERED" ? "REGISTERED" : "DROP_IN";

    // Positions — optional, comma-separated value (use quotes in CSV for multiple: "PG,SG")
    const positions: PositionValue[] = [];
    const rawPositions = get(col("positions"));
    if (rawPositions) {
      const parts = rawPositions.split(",").map((p) => p.trim().toUpperCase());
      const invalid = parts.filter((p) => !(POSITION_VALUES as readonly string[]).includes(p));
      if (invalid.length > 0) {
        errors.push({ rowIndex: i, message: `עמדה לא תקינה: ${invalid.join(", ")}` });
        continue;
      }
      positions.push(...(parts as PositionValue[]));
    }

    rows.push({
      nickname,
      firstNameHe: get(col("firstnamehe")) || null,
      lastNameHe: get(col("lastnamehe")) || null,
      firstNameEn: get(col("firstnameen")) || null,
      lastNameEn: get(col("lastnameen")) || null,
      phone,
      birthdate,
      playerKind,
      positions,
    });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Aggregates CSV (wide format: nickname, year columns)
// ---------------------------------------------------------------------------

export type ParsedAggregateRow = {
  nickname: string;
  year: number;
  count: number;
};

const YEAR_MIN = 2000;
const CURRENT_YEAR = new Date().getFullYear();

export function parseAggregatesCsv(text: string): ParseResult<ParsedAggregateRow> {
  const rows: ParsedAggregateRow[] = [];
  const errors: RowError[] = [];

  const lines = parseCsvText(text).filter((r) => r.some((c) => c !== ""));
  if (lines.length === 0) return { rows, errors };

  const header = lines[0];
  if (header[0].toLowerCase() !== "nickname") {
    errors.push({ rowIndex: 0, message: "העמודה הראשונה חייבת להיות nickname" });
    return { rows, errors };
  }

  // Collect valid year columns (skip current year and invalid years)
  const yearCols: { year: number; colIdx: number }[] = [];
  for (let c = 1; c < header.length; c++) {
    const y = parseInt(header[c], 10);
    if (isNaN(y)) continue;
    if (y < YEAR_MIN || y >= CURRENT_YEAR) continue;
    yearCols.push({ year: y, colIdx: c });
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    const nickname = cells[0]?.trim();
    if (!nickname) {
      errors.push({ rowIndex: i, message: "nickname ריק" });
      continue;
    }

    for (const { year, colIdx } of yearCols) {
      const raw = (cells[colIdx] ?? "").trim();
      if (raw === "") continue; // empty = skip

      const count = parseInt(raw, 10);
      if (isNaN(count) || count < 0) {
        errors.push({ rowIndex: i, message: `ערך לא תקין בעמודת ${year}: "${raw}"` });
        continue;
      }

      rows.push({ nickname, year, count });
    }
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Payments CSV (wide format: date, nickname columns)
// ---------------------------------------------------------------------------

export type ParsedPaymentRow = {
  nickname: string;
  date: Date;
  amount: number;
};

export function parsePaymentsCsv(text: string): ParseResult<ParsedPaymentRow> {
  const rows: ParsedPaymentRow[] = [];
  const errors: RowError[] = [];

  const lines = parseCsvText(text).filter((r) => r.some((c) => c !== ""));
  if (lines.length === 0) return { rows, errors };

  const header = lines[0];
  if (header[0].toLowerCase() !== "date") {
    errors.push({ rowIndex: 0, message: "העמודה הראשונה חייבת להיות date" });
    return { rows, errors };
  }

  const nicknames = header.slice(1).map((n) => n.trim());

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    const rawDate = cells[0]?.trim();
    if (!rawDate) {
      errors.push({ rowIndex: i, message: "תאריך ריק" });
      continue;
    }

    const date = new Date(rawDate);
    if (isNaN(date.getTime())) {
      errors.push({ rowIndex: i, message: `תאריך לא תקין: ${rawDate}` });
      continue;
    }

    for (let c = 1; c < header.length; c++) {
      const raw = (cells[c] ?? "").trim();
      if (raw === "") continue; // empty = no payment

      const amount = parseInt(raw, 10);
      if (isNaN(amount)) {
        errors.push({ rowIndex: i, message: `סכום לא תקין בעמודת "${nicknames[c - 1]}": "${raw}"` });
        continue;
      }
      if (amount === 0) {
        errors.push({ rowIndex: i, message: `סכום אפס בעמודת "${nicknames[c - 1]}" — מדלג` });
        continue;
      }

      rows.push({ nickname: nicknames[c - 1], date, amount });
    }
  }

  return { rows, errors };
}
