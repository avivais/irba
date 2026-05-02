"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { RateActionState } from "@/app/admin/(protected)/config/rates/actions";
import { DateInputIL } from "@/components/ui/date-input-il";

type Props = {
  action: (prev: RateActionState, formData: FormData) => Promise<RateActionState>;
  defaultEffectiveFrom?: string; // "YYYY-MM-DD"
  defaultPricePerHour?: number;
  submitLabel: string;
};

const initialState: RateActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";

export function HourlyRateForm({ action, defaultEffectiveFrom, defaultPricePerHour, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="effectiveFrom" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            תאריך תחילת תוקף
          </label>
          <DateInputIL
            id="effectiveFrom"
            name="effectiveFrom"
            defaultValue={defaultEffectiveFrom}
            ariaLabel="תאריך תחילת תוקף"
            className={`${inputBase} ${inputNormal}`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pricePerHour" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            מחיר לשעה{" "}
            <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">(₪)</span>
          </label>
          <input
            id="pricePerHour"
            type="number"
            name="pricePerHour"
            defaultValue={defaultPricePerHour}
            min={1}
            step={0.5}
            className={`${inputBase} ${inputNormal}`}
            required
          />
        </div>
      </div>

      {!state.ok && state.message && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-300/50 sm:w-auto sm:min-w-[12rem]"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            שומר…
          </>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}
