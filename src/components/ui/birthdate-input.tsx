"use client";

import { useRef, useState } from "react";
import { Calendar } from "lucide-react";

const ISRAELI_PLACEHOLDER = "DD/MM/YYYY";
const FORMAT_ERROR = "פורמט תאריך לא תקין. דוגמה: 31/12/1990";
const RANGE_ERROR = "תאריך לא תקין";

function formatIsoToIsraeli(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

/** Auto-formats raw digits/separators into `DD/MM/YYYY` while typing. */
function autoFormatPartial(input: string): string {
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

/** Strict parse for full DD/MM/YYYY (any of /, ., -). Validates ranges. */
function parseIsraeliDate(text: string): ParseResult {
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

  // Verify the date actually exists (e.g. reject 31/02/2020)
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const d = new Date(iso);
  if (
    isNaN(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return { kind: "range-error" };
  }

  return { kind: "ok", iso };
}

type Props = {
  /** Form field name for submission (the ISO value). */
  name: string;
  /** Initial ISO value (yyyy-mm-dd) or empty. */
  initialIso: string;
  /** Server-side error message for this field, if any. */
  serverError?: string;
  /** Visual style for the text input (border + bg + focus colors). */
  inputClassName: string;
  /** Visual style for invalid state (added when client/server error present). */
  invalidClassName?: string;
  /** Visual style for the calendar icon button container. */
  buttonClassName: string;
  /** Render the inline error message. */
  renderError?: (msg: string) => React.ReactNode;
};

export function BirthdateInput({
  name,
  initialIso,
  serverError,
  inputClassName,
  invalidClassName,
  buttonClassName,
  renderError,
}: Props) {
  const [text, setText] = useState(
    initialIso ? formatIsoToIsraeli(initialIso) : "",
  );
  const [touched, setTouched] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const parseResult = parseIsraeliDate(text);
  const iso = parseResult.kind === "ok" ? parseResult.iso : "";

  const digitCount = text.replace(/\D/g, "").length;
  // Show error once the user has typed all 8 digits, or after blur with content.
  const shouldShowClientError =
    digitCount === 8 || (touched && text.trim() !== "");

  let clientError: string | null = null;
  if (shouldShowClientError) {
    if (parseResult.kind === "format-error") clientError = FORMAT_ERROR;
    else if (parseResult.kind === "range-error") clientError = RANGE_ERROR;
    else if (parseResult.kind === "incomplete") clientError = FORMAT_ERROR;
  }

  const errorMsg = clientError ?? serverError ?? null;
  const isInvalid = Boolean(errorMsg);

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          dir="ltr"
          value={text}
          onChange={(e) => setText(autoFormatPartial(e.target.value))}
          onBlur={() => setTouched(true)}
          placeholder={ISRAELI_PLACEHOLDER}
          aria-invalid={isInvalid}
          aria-describedby={errorMsg ? `${name}-error` : undefined}
          maxLength={10}
          className={`${inputClassName} ${isInvalid && invalidClassName ? invalidClassName : ""} flex-1`}
        />

        {/* Calendar button: native date input is positioned on top
            with opacity 0, so a tap lands on the date input and
            opens the native picker reliably across browsers. */}
        <div className={`relative ${buttonClassName}`}>
          <div
            className="flex h-full w-full items-center justify-center"
            aria-hidden
          >
            <Calendar className="h-5 w-5" />
          </div>
          <input
            ref={dateInputRef}
            type="date"
            value={iso}
            onChange={(e) => {
              const val = e.target.value;
              setText(val ? formatIsoToIsraeli(val) : "");
              setTouched(true);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="פתח לוח שנה"
            min="1900-01-01"
            max="2100-12-31"
          />
        </div>

        {/* Hidden input that actually carries the ISO value to the form. */}
        <input type="hidden" name={name} value={iso} />
      </div>

      {errorMsg && renderError ? renderError(errorMsg) : null}
      {errorMsg && !renderError ? (
        <p
          id={`${name}-error`}
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
        >
          {errorMsg}
        </p>
      ) : null}
    </>
  );
}
