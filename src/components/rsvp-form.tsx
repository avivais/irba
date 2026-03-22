"use client";

import { useActionState, useEffect, useState } from "react";
import {
  attendAction,
  type RsvpActionState,
} from "@/app/actions/rsvp";
import {
  getAttendFormValidation,
  parseAttendFormFields,
} from "@/lib/rsvp-validation";
import { Loader2 } from "lucide-react";

const initialState: RsvpActionState = { ok: false };

const inputNormal =
  "border-zinc-300 focus:border-green-600 focus:ring-green-600/30 dark:border-zinc-600 dark:focus:border-green-500 dark:focus:ring-green-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";

export function RsvpForm() {
  const [state, formAction, pending] = useActionState(
    attendAction,
    initialState,
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  /** Show field-level errors after blur, or after a blocked submit (e.g. Enter while invalid). */
  const [nameBlurred, setNameBlurred] = useState(false);
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  /** Hide stale server message after the user edits; cleared when a valid submit is sent. */
  const [suppressServerError, setSuppressServerError] = useState(false);

  const validation = getAttendFormValidation({ name, phone });
  const formValid = validation.ok;

  const nameError = validation.ok ? undefined : validation.errors.name;
  const phoneError = validation.ok ? undefined : validation.errors.phone;
  const nameErrorVisible = nameBlurred && Boolean(nameError);
  const phoneErrorVisible = phoneBlurred && Boolean(phoneError);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = parseAttendFormFields({ name, phone });
    if (!result.ok) {
      e.preventDefault();
      setNameBlurred(true);
      setPhoneBlurred(true);
      return;
    }
    setSuppressServerError(false);
  }

  function onFieldChange(
    setter: (v: string) => void,
    value: string,
  ) {
    setter(value);
    setSuppressServerError(true);
  }

  const [dismissedState, setDismissedState] = useState<RsvpActionState | null>(null);

  useEffect(() => {
    if (!state.ok || !state.message) return;
    const t = setTimeout(() => setDismissedState(state), 3000);
    return () => clearTimeout(t);
  }, [state]);

  const serverError =
    !pending &&
    !state.ok &&
    state.message &&
    !suppressServerError
      ? state.message
      : null;

  const showSuccess = state.ok && state.message && state !== dismissedState;
  const submitDisabled = pending || !formValid;

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="name"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          שם מלא
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(e) => onFieldChange(setName, e.target.value)}
          onBlur={() => setNameBlurred(true)}
          aria-invalid={nameErrorVisible}
          aria-describedby={nameErrorVisible ? "name-error" : undefined}
          className={`rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${nameErrorVisible ? inputInvalid : inputNormal}`}
          placeholder="השם שלך"
        />
        {nameErrorVisible ? (
          <p id="name-error" className="text-xs text-red-600 dark:text-red-400">
            {nameError}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="phone"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          טלפון נייד
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={phone}
          onChange={(e) => onFieldChange(setPhone, e.target.value)}
          onBlur={() => setPhoneBlurred(true)}
          aria-invalid={phoneErrorVisible}
          aria-describedby={phoneErrorVisible ? "phone-error" : undefined}
          className={`rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${phoneErrorVisible ? inputInvalid : inputNormal}`}
          placeholder="05xxxxxxxx"
        />
        {phoneErrorVisible ? (
          <p id="phone-error" className="text-xs text-red-600 dark:text-red-400">
            {phoneError}
          </p>
        ) : null}
      </div>

      {serverError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {serverError}
        </p>
      )}

      {showSuccess && (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        title={
          submitDisabled && !pending
            ? "נא למלא שם ומספר טלפון תקינים"
            : undefined
        }
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-green-500/40"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            שולח…
          </>
        ) : (
          "אני מגיע"
        )}
      </button>
    </form>
  );
}
