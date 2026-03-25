"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  upsertAggregateAction,
  type PrecedenceActionState,
} from "@/app/admin/(protected)/precedence/[playerId]/actions";

type Props = { playerId: string; currentYear: number };

const initialState: PrecedenceActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";

export function AggregateUpsertForm({ playerId, currentYear }: Props) {
  const boundAction = upsertAggregateAction.bind(null, playerId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const [year, setYear] = useState("");
  const [count, setCount] = useState("");

  const yearNum = parseInt(year, 10);
  const countNum = parseInt(count, 10);
  const formValid =
    /^\d{4}$/.test(year) &&
    yearNum >= 2000 &&
    yearNum <= 2100 &&
    yearNum < currentYear &&
    /^\d+$/.test(count) &&
    countNum >= 0;

  function handleSuccess() {
    if (state.ok) {
      setYear("");
      setCount("");
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        הוסף / עדכן שנה היסטורית
      </p>
      <form
        action={formAction}
        onSubmit={handleSuccess}
        className="flex flex-wrap items-end gap-3"
        noValidate
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="agg-year"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            שנה
          </label>
          <input
            id="agg-year"
            name="year"
            type="number"
            min={2000}
            max={currentYear - 1}
            step={1}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={`${inputBase} ${inputNormal} w-24`}
            placeholder="2024"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="agg-count"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            נוכחויות
          </label>
          <input
            id="agg-count"
            name="count"
            type="number"
            min={0}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={`${inputBase} ${inputNormal} w-24`}
            placeholder="10"
          />
        </div>

        <button
          type="submit"
          disabled={pending || !formValid}
          className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          שמור
        </button>
      </form>

      {!state.ok && state.message && (
        <p
          role="alert"
          className="mt-2 text-xs text-red-600 dark:text-red-400"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
