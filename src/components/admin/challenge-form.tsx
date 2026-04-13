"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { ChallengeActionState } from "@/app/admin/(protected)/challenges/actions";

type Props = {
  action: (prev: ChallengeActionState, formData: FormData) => Promise<ChallengeActionState>;
  defaultStartDate?: string;
  defaultSessionCount?: number;
  defaultMinMatchesPct?: number;
  submitLabel: string;
};

const initialState: ChallengeActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";

export function ChallengeForm({
  action,
  defaultStartDate,
  defaultSessionCount = 6,
  defaultMinMatchesPct = 50,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Start date */}
      <div className="flex flex-col gap-1">
        <label htmlFor="startDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          תאריך התחלה
        </label>
        <input
          id="startDate"
          type="date"
          name="startDate"
          defaultValue={defaultStartDate ?? today}
          dir="ltr"
          className={`${inputBase} ${inputNormal}`}
          required
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          מפגשים החל מתאריך זה יחשבו לתחרות
        </p>
      </div>

      {/* Session count + Min matches % */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="sessionCount" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            מספר מפגשים
          </label>
          <input
            id="sessionCount"
            type="number"
            name="sessionCount"
            defaultValue={defaultSessionCount}
            min={1}
            step={1}
            className={`${inputBase} ${inputNormal}`}
            required
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            התחרות תסתיים לאחר X מפגשים
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="minMatchesPct" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            סף כניסה לטבלה (%)
          </label>
          <input
            id="minMatchesPct"
            type="number"
            name="minMatchesPct"
            defaultValue={defaultMinMatchesPct}
            min={0}
            max={100}
            step={1}
            className={`${inputBase} ${inputNormal}`}
            required
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            % ממספר המשחקים של השחקן הפעיל ביותר. 0 = כולם
          </p>
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
