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
};

type Props =
  | { mode: "create" }
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

  const action = isEdit
    ? updateSessionAction.bind(null, session!.id)
    : createSessionAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  const [date, setDate] = useState(
    session ? toJerusalemLocalInput(session.date) : "",
  );
  const [maxPlayers, setMaxPlayers] = useState(
    String(session?.maxPlayers ?? 15),
  );
  const [isClosed, setIsClosed] = useState(session?.isClosed ?? false);
  const [suppressServerError, setSuppressServerError] = useState(false);
  const [dateBlurred, setDateBlurred] = useState(false);
  const [maxPlayersBlurred, setMaxPlayersBlurred] = useState(false);

  const validation = parseSessionForm({
    date,
    maxPlayers,
    isClosed: isClosed ? "on" : undefined,
  });

  const fieldErrors = validation.ok ? {} : validation.errors;
  const dateError = fieldErrors.date;
  const maxPlayersError = fieldErrors.maxPlayers;
  const dateErrorVisible = dateBlurred && Boolean(dateError);
  const maxPlayersErrorVisible = maxPlayersBlurred && Boolean(maxPlayersError);
  const formValid = validation.ok;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validation.ok) {
      e.preventDefault();
      setDateBlurred(true);
      setMaxPlayersBlurred(true);
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

      {/* Max players */}
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
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-zinc-300/50"
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
