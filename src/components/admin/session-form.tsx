"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  createSessionAction,
  updateSessionAction,
  type SessionActionState,
} from "@/app/admin/(protected)/sessions/actions";
import { parseSessionForm } from "@/lib/session-validation";

type SessionData = {
  id: string;
  date: Date;
  maxPlayers: number;
  isClosed: boolean;
  durationMinutes: number | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
};

type SessionDefaults = {
  date: string;        // datetime-local "YYYY-MM-DDTHH:mm"
  maxPlayers: number;
  durationMinutes: number;
  locationName: string;
  locationLat: string;
  locationLng: string;
  waNotify: {
    sessionOpenEnabled: boolean;
    sessionOpenTemplate: string;
  };
};

type Props =
  | { mode: "create"; defaults: SessionDefaults }
  | { mode: "edit"; session: SessionData };

const initialState: SessionActionState = { ok: false };

const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";
const inputBase =
  "rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";

/** Convert a UTC Date to a datetime-local string in Israel timezone (YYYY-MM-DDTHH:mm). */
function toJerusalemLocalInput(date: Date): string {
  return date
    .toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" })
    .replace(" ", "T")
    .slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" → "d.m.yyyy HH:mm" (no leading zeros on day/month, 2-digit time). */
function formatDateDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  const [, y, mo, d, h, mi] = m;
  return `${parseInt(d, 10)}.${parseInt(mo, 10)}.${y} ${h}:${mi}`;
}

/** "d.m.yyyy HH:mm" (flexible) → "YYYY-MM-DDTHH:mm", or null if invalid. */
function parseDateDisplay(text: string): string | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})[\s,]+(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mi = parseInt(m[5], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  // Cross-check day is valid for the given month (handles 31.2, 30.2, 31.4, etc.)
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function SessionForm(props: Props) {
  const isEdit = props.mode === "edit";
  const session = isEdit ? props.session : null;
  const defaults = isEdit ? null : props.defaults;

  const action = isEdit
    ? updateSessionAction.bind(null, session!.id)
    : createSessionAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  const [date, setDate] = useState(
    session ? toJerusalemLocalInput(session.date) : defaults!.date,
  );
  const [dateDisplay, setDateDisplay] = useState(() =>
    formatDateDisplay(session ? toJerusalemLocalInput(session.date) : defaults!.date),
  );
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(
    String(session?.maxPlayers ?? defaults!.maxPlayers),
  );
  const [isClosed, setIsClosed] = useState(session?.isClosed ?? false);
  const [durationMinutes, setDurationMinutes] = useState(
    session?.durationMinutes != null
      ? String(session.durationMinutes)
      : String(defaults?.durationMinutes ?? ""),
  );
  const [locationName, setLocationName] = useState(
    session?.locationName ?? defaults?.locationName ?? "",
  );
  const [locationLat, setLocationLat] = useState(
    session?.locationLat != null ? String(session.locationLat) : defaults?.locationLat ?? "",
  );
  const [locationLng, setLocationLng] = useState(
    session?.locationLng != null ? String(session.locationLng) : defaults?.locationLng ?? "",
  );
  const [suppressServerError, setSuppressServerError] = useState(false);
  const [dateBlurred, setDateBlurred] = useState(false);
  const [maxPlayersBlurred, setMaxPlayersBlurred] = useState(false);
  const [durationBlurred, setDurationBlurred] = useState(false);

  // Dirty tracking — mirrors PlayerForm pattern
  const lastSavedRef = useRef({
    date: session ? toJerusalemLocalInput(session.date) : defaults!.date,
    maxPlayers: String(session?.maxPlayers ?? defaults!.maxPlayers),
    isClosed: session?.isClosed ?? false,
    durationMinutes: session?.durationMinutes != null ? String(session.durationMinutes) : String(defaults?.durationMinutes ?? ""),
    locationName: session?.locationName ?? defaults?.locationName ?? "",
    locationLat: session?.locationLat != null ? String(session.locationLat) : defaults?.locationLat ?? "",
    locationLng: session?.locationLng != null ? String(session.locationLng) : defaults?.locationLng ?? "",
  });
  const [, setDirtyVersion] = useState(0);

  const s = lastSavedRef.current;
  const isDirty = isEdit
    ? (
      date !== s.date ||
      maxPlayers !== s.maxPlayers ||
      isClosed !== s.isClosed ||
      durationMinutes !== s.durationMinutes ||
      locationName !== s.locationName ||
      locationLat !== s.locationLat ||
      locationLng !== s.locationLng
    )
    : true;

  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // WA notification override — create mode only
  const [waOpen, setWaOpen] = useState(false);
  const [waSessionOpenEnabled, setWaSessionOpenEnabled] = useState(
    defaults?.waNotify?.sessionOpenEnabled ?? true,
  );
  const [waSessionOpenTemplate, setWaSessionOpenTemplate] = useState(
    defaults?.waNotify?.sessionOpenTemplate ?? "",
  );

  const validation = parseSessionForm({
    date,
    maxPlayers,
    isClosed: isClosed ? "on" : undefined,
    durationMinutes,
    locationName,
    locationLat,
    locationLng,
  });

  const fieldErrors = validation.ok ? {} : validation.errors;
  const dateError = fieldErrors.date;
  const maxPlayersError = fieldErrors.maxPlayers;
  const durationError = fieldErrors.durationMinutes;
  const dateErrorVisible = dateBlurred && Boolean(dateError);
  const maxPlayersErrorVisible = maxPlayersBlurred && Boolean(maxPlayersError);
  const durationErrorVisible = durationBlurred && Boolean(durationError);
  const formValid = validation.ok;

  const hasLatLng = locationLat.trim() !== "" && locationLng.trim() !== "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validation.ok) {
      e.preventDefault();
      setDateBlurred(true);
      setMaxPlayersBlurred(true);
      setDurationBlurred(true);
      return;
    }
    setSuppressServerError(false);
  }

  function onFieldChange(setter: (v: string) => void, value: string) {
    setter(value);
    setSuppressServerError(true);
  }

  function handleBack() {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      router.push("/admin/sessions");
    }
  }

  // beforeunload guard (covers refresh / close tab / address bar navigation)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // popstate guard (covers mobile browser back button / soft navigation back)
  useEffect(() => {
    history.pushState(null, "", window.location.href);
    const handler = () => {
      if (isDirtyRef.current) {
        history.pushState(null, "", window.location.href);
        setConfirmOpen(true);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Reset dirty tracking after successful save
  useEffect(() => {
    if (!state.ok) return;
    lastSavedRef.current = { date, maxPlayers, isClosed, durationMinutes, locationName, locationLat, locationLng };
    setDirtyVersion((v) => v + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const serverError =
    !pending && !state.ok && state.message && !suppressServerError
      ? state.message
      : null;

  const successMessage =
    !pending && state.ok && state.message ? state.message : null;

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-5"
      noValidate
    >
      {/* Date */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="session-date"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          תאריך ושעה
        </label>
        <div className="relative">
          <input
            id="session-date"
            type="text"
            inputMode="numeric"
            value={dateDisplay}
            placeholder="יי.חח.שששש שש:דד"
            onChange={(e) => {
              const text = e.target.value;
              setDateDisplay(text);
              setSuppressServerError(true);
              const iso = parseDateDisplay(text);
              // When text doesn't parse, clear canonical date so validation catches it
              setDate(iso ?? "");
            }}
            onBlur={() => {
              setDateBlurred(true);
              // Normalize display on blur if parseable
              const iso = parseDateDisplay(dateDisplay);
              if (iso) setDateDisplay(formatDateDisplay(iso));
            }}
            aria-invalid={dateErrorVisible}
            aria-describedby={dateErrorVisible ? "session-date-error" : undefined}
            dir="ltr"
            className={`${inputBase} w-full pr-12 ${dateErrorVisible ? inputInvalid : inputNormal}`}
          />
          <button
            type="button"
            onClick={() => {
              const el = datePickerRef.current;
              if (!el) return;
              if (typeof el.showPicker === "function") el.showPicker();
              else el.click();
            }}
            aria-label="בחר תאריך ושעה"
            className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <Calendar className="h-5 w-5" aria-hidden />
          </button>
          <input
            ref={datePickerRef}
            type="datetime-local"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              setDate(v);
              setDateDisplay(formatDateDisplay(v));
              setSuppressServerError(true);
            }}
            tabIndex={-1}
            aria-hidden
            className="absolute inset-0 h-0 w-0 opacity-0"
          />
        </div>
        <input type="hidden" name="date" value={date} />
        {dateErrorVisible && (
          <p id="session-date-error" className="text-xs text-red-600 dark:text-red-400">
            {dateError}
          </p>
        )}
      </div>

      {/* Max players + Duration (side by side on sm+) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="session-max-players"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            מקסימום שחקנים
          </label>
          <input
            id="session-max-players"
            name="maxPlayers"
            type="number"
            min={1}
            max={100}
            step={1}
            value={maxPlayers}
            onChange={(e) => onFieldChange(setMaxPlayers, e.target.value)}
            onBlur={() => setMaxPlayersBlurred(true)}
            aria-invalid={maxPlayersErrorVisible}
            aria-describedby={
              maxPlayersErrorVisible ? "session-max-players-error" : undefined
            }
            className={`${inputBase} ${maxPlayersErrorVisible ? inputInvalid : inputNormal}`}
          />
          {maxPlayersErrorVisible && (
            <p
              id="session-max-players-error"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {maxPlayersError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="session-duration"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            משך{" "}
            <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
              (דקות)
            </span>
          </label>
          <input
            id="session-duration"
            name="durationMinutes"
            type="number"
            min={30}
            max={480}
            step={15}
            value={durationMinutes}
            placeholder={`ברירת מחדל: ${defaults?.durationMinutes ?? 120}`}
            onChange={(e) => onFieldChange(setDurationMinutes, e.target.value)}
            onBlur={() => setDurationBlurred(true)}
            aria-invalid={durationErrorVisible}
            aria-describedby={durationErrorVisible ? "session-duration-error" : undefined}
            className={`${inputBase} ${durationErrorVisible ? inputInvalid : inputNormal}`}
          />
          {durationErrorVisible && (
            <p id="session-duration-error" className="text-xs text-red-600 dark:text-red-400">
              {durationError}
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          מיקום
        </p>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="session-location-name"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            שם המיקום
          </label>
          <input
            id="session-location-name"
            name="locationName"
            type="text"
            maxLength={200}
            value={locationName}
            onChange={(e) => onFieldChange(setLocationName, e.target.value)}
            placeholder="שם המגרש / הכתובת"
            className={`${inputBase} ${inputNormal}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="session-location-lat"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Latitude
            </label>
            <input
              id="session-location-lat"
              name="locationLat"
              type="text"
              inputMode="decimal"
              value={locationLat}
              onChange={(e) => onFieldChange(setLocationLat, e.target.value)}
              placeholder="32.3214"
              className={`${inputBase} ${inputNormal}`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="session-location-lng"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Longitude
            </label>
            <input
              id="session-location-lng"
              name="locationLng"
              type="text"
              inputMode="decimal"
              value={locationLng}
              onChange={(e) => onFieldChange(setLocationLng, e.target.value)}
              placeholder="34.8529"
              className={`${inputBase} ${inputNormal}`}
            />
          </div>
        </div>

        {hasLatLng && (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <a
                href={`https://www.google.com/maps?q=${locationLat},${locationLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Google Maps ↗
              </a>
              <a
                href={`https://waze.com/ul?ll=${locationLat},${locationLng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Waze ↗
              </a>
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(locationLng) - 0.005},${parseFloat(locationLat) - 0.005},${parseFloat(locationLng) + 0.005},${parseFloat(locationLat) + 0.005}&layer=mapnik&marker=${locationLat},${locationLng}`}
                width="100%"
                height="200"
                style={{ border: 0 }}
                title="מפה"
                loading="lazy"
              />
            </div>
          </>
        )}
      </div>

      {/* isClosed (edit only) */}
      {isEdit && (
        <div className="flex items-center gap-3">
          <input
            id="session-is-closed"
            name="isClosed"
            type="checkbox"
            value="on"
            checked={isClosed}
            onChange={(e) => {
              setIsClosed(e.target.checked);
              setSuppressServerError(true);
            }}
            className="h-5 w-5 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
          />
          <label
            htmlFor="session-is-closed"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            מפגש סגור להרשמה
          </label>
        </div>
      )}

      {/* WA notification override — create mode only */}
      {!isEdit && (
        <div className="flex flex-col gap-0 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setWaOpen((v) => !v)}
            className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 rounded-lg"
          >
            <span>התראות וואטסאפ</span>
            {waOpen ? (
              <ChevronUp className="h-4 w-4 text-zinc-400" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-400" aria-hidden />
            )}
          </button>

          {waOpen && (
            <div className="flex flex-col gap-4 border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-700">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={waSessionOpenEnabled}
                  onChange={(e) => setWaSessionOpenEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
                />
                שלח התראת פתיחת מפגש לקבוצה
              </label>
              <input
                type="hidden"
                name="wa_override_session_open_enabled"
                value={waSessionOpenEnabled ? "true" : "false"}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="wa_override_session_open_template" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  תבנית הודעה
                </label>
                <textarea
                  id="wa_override_session_open_template"
                  name="wa_override_session_open_template"
                  value={waSessionOpenTemplate}
                  onChange={(e) => setWaSessionOpenTemplate(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className={`${inputBase} resize-y ${inputNormal}`}
                />
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  משתנה זמין: {"{date}"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {serverError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {serverError}
        </p>
      )}

      {successMessage && (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
        >
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !formValid || (isEdit && !isDirty)}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-300/50"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            שומר…
          </>
        ) : isEdit ? (
          "שמור שינויים"
        ) : (
          "צור מפגש"
        )}
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">יש שינויים שלא נשמרו</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">האם לעזוב את הדף? השינויים לא יישמרו.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); router.push("/admin/sessions"); }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:bg-red-700"
              >
                עזוב
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:active:bg-zinc-500"
              >
                המשך עריכה
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
