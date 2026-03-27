"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
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

  const serverError =
    !pending && !state.ok && state.message && !suppressServerError
      ? state.message
      : null;

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
        <input
          id="session-date"
          name="date"
          type="datetime-local"
          value={date}
          onChange={(e) => onFieldChange(setDate, e.target.value)}
          onBlur={() => setDateBlurred(true)}
          aria-invalid={dateErrorVisible}
          aria-describedby={dateErrorVisible ? "session-date-error" : undefined}
          className={`${inputBase} ${dateErrorVisible ? inputInvalid : inputNormal}`}
        />
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

      {serverError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !formValid}
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
    </form>
  );
}
