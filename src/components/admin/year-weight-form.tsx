"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createYearWeightAction,
  updateYearWeightAction,
  type WeightActionState,
} from "@/app/admin/(protected)/precedence/weights/actions";
import { parseYearWeightForm } from "@/lib/year-weight-validation";

type Props =
  | { mode: "create" }
  | { mode: "edit"; year: number; weight: number };

const initialState: WeightActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";
const inputDisabled = "cursor-not-allowed opacity-60 bg-zinc-50 dark:bg-zinc-800";

export function YearWeightForm(props: Props) {
  const isEdit = props.mode === "edit";

  const action = isEdit
    ? updateYearWeightAction.bind(null, (props as { year: number }).year)
    : createYearWeightAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  const [year, setYear] = useState(
    isEdit ? String((props as { year: number }).year) : "",
  );
  const [weight, setWeight] = useState(
    isEdit ? String((props as { weight: number }).weight) : "",
  );
  const [suppressServerError, setSuppressServerError] = useState(false);

  const validation = parseYearWeightForm({
    year: isEdit ? String((props as { year: number }).year) : year,
    weight,
  });
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
      {/* Year */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="weight-year"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          שנה
          {isEdit && (
            <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
              (לא ניתן לשינוי)
            </span>
          )}
        </label>
        {isEdit ? (
          <>
            <input
              id="weight-year"
              name="year"
              type="number"
              value={year}
              disabled
              className={`${inputBase} ${inputDisabled} ${inputNormal}`}
            />
            <input type="hidden" name="year" value={year} />
          </>
        ) : (
          <input
            id="weight-year"
            name="year"
            type="number"
            min={2000}
            max={2100}
            step={1}
            value={year}
            onChange={(e) => onFieldChange(setYear, e.target.value)}
            aria-invalid={Boolean(fieldErrors.year)}
            className={`${inputBase} ${fieldErrors.year ? inputInvalid : inputNormal}`}
            placeholder="2024"
          />
        )}
        {fieldErrors.year && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.year}
          </p>
        )}
      </div>

      {/* Weight */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="weight-value"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          משקל
          <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
            (אפס או יותר)
          </span>
        </label>
        <input
          id="weight-value"
          name="weight"
          type="number"
          min={0}
          step={0.1}
          value={weight}
          onChange={(e) => onFieldChange(setWeight, e.target.value)}
          aria-invalid={Boolean(fieldErrors.weight)}
          className={`${inputBase} ${fieldErrors.weight ? inputInvalid : inputNormal}`}
          placeholder="1.0"
        />
        {fieldErrors.weight && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.weight}
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
          "הוסף משקל"
        )}
      </button>
    </form>
  );
}
