"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

const PLACEHOLDER = "DD/MM/YYYY";
const FORMAT_ERROR = "פורמט תאריך לא תקין. דוגמה: 31/12/1990";
const RANGE_ERROR = "תאריך לא תקין";

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Strips non-digits and standardises into `DD/MM/YYYY` while typing. */
function autoFormat(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

type ParseResult =
  | { kind: "empty" }
  | { kind: "incomplete" }
  | { kind: "format-error" }
  | { kind: "range-error" }
  | { kind: "ok"; iso: string };

/** Strict parse for full DD/MM/YYYY (any of /, ., -). Validates calendar dates. */
export function parseDateIL(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "empty" };

  const m = trimmed.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!m) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 8) return { kind: "incomplete" };
    return { kind: "format-error" };
  }

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);

  if (month < 1 || month > 12) return { kind: "range-error" };
  if (day < 1 || day > 31) return { kind: "range-error" };
  if (year < 1900 || year > 2100) return { kind: "range-error" };

  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { kind: "range-error" };
  }

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { kind: "ok", iso };
}

type Props = {
  /** Form field name for submission (the ISO YYYY-MM-DD value). */
  name: string;
  /** Initial ISO value (yyyy-mm-dd). */
  defaultValue?: string;
  /** Class names for the visible text input. */
  className?: string;
  /** Class names appended when invalid. */
  invalidClassName?: string;
  id?: string;
  ariaLabel?: string;
  autoComplete?: string;
  /** Native picker bounds (ISO yyyy-mm-dd). */
  min?: string;
  max?: string;
  /** Fires with the parsed ISO value (or "" if invalid/empty). */
  onChange?: (iso: string) => void;
  /** External invalid override (e.g. server error visible). */
  invalid?: boolean;
  /** Server-side error message — rendered inline below the input. */
  serverError?: string;
};

export function DateInputIL({
  name,
  defaultValue = "",
  className = "",
  invalidClassName = "",
  id,
  ariaLabel,
  autoComplete,
  min,
  max,
  onChange,
  invalid,
  serverError,
}: Props) {
  const [text, setText] = useState(isoToDisplay(defaultValue));
  const [touched, setTouched] = useState(false);

  const parseResult = parseDateIL(text);
  const iso = parseResult.kind === "ok" ? parseResult.iso : "";

  const digitCount = text.replace(/\D/g, "").length;
  // Show error once user has typed all 8 digits, or after blur with content.
  const showClient = digitCount === 8 || (touched && text.trim() !== "");

  let clientError: string | null = null;
  if (showClient) {
    if (parseResult.kind === "format-error" || parseResult.kind === "incomplete") {
      clientError = FORMAT_ERROR;
    } else if (parseResult.kind === "range-error") {
      clientError = RANGE_ERROR;
    }
  }

  const errorMsg = clientError ?? serverError ?? null;
  const isInvalid = Boolean(invalid) || Boolean(errorMsg);

  function handleTextChange(raw: string) {
    const formatted = autoFormat(raw);
    setText(formatted);
    const r = parseDateIL(formatted);
    onChange?.(r.kind === "ok" ? r.iso : "");
  }

  function handlePickerChange(v: string) {
    setText(v ? isoToDisplay(v) : "");
    setTouched(true);
    onChange?.(v);
  }

  return (
    <>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete={autoComplete}
          aria-label={ariaLabel}
          aria-invalid={isInvalid || undefined}
          aria-describedby={errorMsg ? `${name}-error` : undefined}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={PLACEHOLDER}
          maxLength={10}
          dir="ltr"
          className={`w-full pr-10 ${className} ${isInvalid ? invalidClassName : ""}`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500 dark:text-zinc-400">
          <Calendar className="h-4 w-4" aria-hidden />
        </div>
        <input
          type="date"
          value={iso}
          min={min}
          max={max}
          onChange={(e) => handlePickerChange(e.target.value)}
          aria-label={ariaLabel ? `${ariaLabel} — בחר מלוח` : "בחר תאריך"}
          dir="ltr"
          className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0"
        />
        <input type="hidden" name={name} value={iso} />
      </div>

      {errorMsg && (
        <p
          id={`${name}-error`}
          role="alert"
          className="mt-1 text-xs text-red-600 dark:text-red-400"
        >
          {errorMsg}
        </p>
      )}
    </>
  );
}
