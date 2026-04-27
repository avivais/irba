"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

/** "YYYY-MM-DD" → "d.m.yyyy" (no leading zeros on day/month). */
function formatDateDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${parseInt(m[3], 10)}.${parseInt(m[2], 10)}.${m[1]}`;
}

/** "d.m.yyyy" (flexible) → "YYYY-MM-DD", or null if invalid. */
function parseDateDisplay(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type Props = {
  name: string;
  defaultValue?: string; // "YYYY-MM-DD"
  className?: string;
  id?: string;
  "aria-label"?: string;
  /** Called with the parsed ISO value ("" when invalid/empty). */
  onChange?: (iso: string) => void;
  invalid?: boolean;
};

/**
 * Israeli-format date field: displays `d.m.yyyy` and submits a hidden `name=YYYY-MM-DD`
 * form value. A native date picker is overlaid on a calendar icon on the right.
 */
export function DateFieldIL({
  name,
  defaultValue = "",
  className = "",
  id,
  "aria-label": ariaLabel,
  onChange,
  invalid,
}: Props) {
  const [iso, setIso] = useState(defaultValue);
  const [display, setDisplay] = useState(formatDateDisplay(defaultValue));

  function updateIso(next: string) {
    setIso(next);
    onChange?.(next);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        placeholder="d.m.yyyy"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const text = e.target.value;
          setDisplay(text);
          const parsed = parseDateDisplay(text);
          updateIso(parsed ?? "");
        }}
        onBlur={() => {
          const parsed = parseDateDisplay(display);
          if (parsed) setDisplay(formatDateDisplay(parsed));
        }}
        dir="ltr"
        className={`w-full pr-10 ${className}`}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500 dark:text-zinc-400"
      >
        <Calendar className="h-4 w-4" aria-hidden />
      </div>
      <input
        type="date"
        value={iso}
        onChange={(e) => {
          const v = e.target.value;
          updateIso(v);
          setDisplay(formatDateDisplay(v));
        }}
        aria-label={ariaLabel ? `${ariaLabel} — בחר מלוח` : "בחר תאריך"}
        dir="ltr"
        className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0"
      />
      <input type="hidden" name={name} value={iso} />
    </div>
  );
}
