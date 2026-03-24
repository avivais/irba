"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createAdjustmentAction,
  updateAdjustmentAction,
  type PrecedenceActionState,
} from "@/app/admin/(protected)/precedence/[playerId]/actions";
import { parseAdjustmentForm } from "@/lib/adjustment-validation";

type AdjustmentData = {
  id: string;
  date: string; // YYYY-MM-DD
  points: number;
  description: string;
};

type Props =
  | { mode: "create"; playerId: string }
  | { mode: "edit"; playerId: string; adjustment: AdjustmentData };

const initialState: PrecedenceActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";

export function AdjustmentForm(props: Props) {
  const isEdit = props.mode === "edit";
  const adj = isEdit ? (props as { adjustment: AdjustmentData }).adjustment : null;

  const action = isEdit
    ? updateAdjustmentAction.bind(null, props.playerId, adj!.id)
    : createAdjustmentAction.bind(null, props.playerId);

  const [state, formAction, pending] = useActionState(action, initialState);

  const [date, setDate] = useState(adj?.date ?? "");
  const [points, setPoints] = useState(adj != null ? String(adj.points) : "");
  const [description, setDescription] = useState(adj?.description ?? "");
  const [suppressServerError, setSuppressServerError] = useState(false);

  const validation = parseAdjustmentForm({ date, points, description });
  const fieldErrors = validation.ok ? {} : validation.errors;
  const formValid = validation.ok;

  function onFieldChange(setter: (v: string) => void, value: string) {
    setter(value);
    setSuppressServerError(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validation.ok) {
      e.preventDefault();
      return;
    }
    setSuppressServerError(false);
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
          htmlFor="adj-date"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          תאריך
        </label>
        <input
          id="adj-date"
          name="date"
          type="date"
          value={date}
          onChange={(e) => onFieldChange(setDate, e.target.value)}
          aria-invalid={Boolean(fieldErrors.date)}
          className={`${inputBase} ${fieldErrors.date ? inputInvalid : inputNormal}`}
        />
        {fieldErrors.date && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.date}
          </p>
        )}
      </div>

      {/* Points */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="adj-points"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          נקודות
          <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
            (חיובי = בונוס, שלילי = קנס)
          </span>
        </label>
        <input
          id="adj-points"
          name="points"
          type="number"
          step={0.5}
          value={points}
          onChange={(e) => onFieldChange(setPoints, e.target.value)}
          aria-invalid={Boolean(fieldErrors.points)}
          className={`${inputBase} ${fieldErrors.points ? inputInvalid : inputNormal}`}
          placeholder="2 או -1"
        />
        {fieldErrors.points && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.points}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="adj-description"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          תיאור
        </label>
        <input
          id="adj-description"
          name="description"
          type="text"
          maxLength={200}
          value={description}
          onChange={(e) => onFieldChange(setDescription, e.target.value)}
          aria-invalid={Boolean(fieldErrors.description)}
          className={`${inputBase} ${fieldErrors.description ? inputInvalid : inputNormal}`}
          placeholder="בונוס / קנס / הסבר"
        />
        {fieldErrors.description && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.description}
          </p>
        )}
      </div>

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
          "הוסף התאמה"
        )}
      </button>
    </form>
  );
}
