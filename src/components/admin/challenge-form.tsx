"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { METRIC_VALUES, METRIC_LABELS, METRIC_DESCRIPTIONS } from "@/lib/challenge-validation";
import type { ChallengeActionState } from "@/app/admin/(protected)/challenges/actions";
import type { ChallengeMetric } from "@/lib/challenge-analytics";

type Props = {
  action: (prev: ChallengeActionState, formData: FormData) => Promise<ChallengeActionState>;
  defaultTitle?: string;
  defaultMetric?: ChallengeMetric;
  defaultEligibilityMinPct?: number;
  defaultRoundCount?: number;
  defaultPrize?: string;
  submitLabel: string;
};

const initialState: ChallengeActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";

export function ChallengeForm({
  action,
  defaultTitle = "",
  defaultMetric = "win_ratio",
  defaultEligibilityMinPct = 50,
  defaultRoundCount = 0,
  defaultPrize = "",
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          כותרת
        </label>
        <input
          id="title"
          type="text"
          name="title"
          defaultValue={defaultTitle}
          maxLength={120}
          placeholder="למשל: מלך ה-Win Rate"
          className={`${inputBase} ${inputNormal}`}
          required
        />
      </div>

      {/* Metric */}
      <div className="flex flex-col gap-1">
        <label htmlFor="metric" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          מדד
        </label>
        <select
          id="metric"
          name="metric"
          defaultValue={defaultMetric}
          className={`${inputBase} ${inputNormal}`}
        >
          {METRIC_VALUES.map((m) => (
            <option key={m} value={m}>
              {METRIC_LABELS[m]}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {METRIC_DESCRIPTIONS[defaultMetric]}
        </p>
      </div>

      {/* Eligibility + Round count */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="eligibilityMinPct" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            סף נוכחות{" "}
            <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">(%)</span>
          </label>
          <input
            id="eligibilityMinPct"
            type="number"
            name="eligibilityMinPct"
            defaultValue={defaultEligibilityMinPct}
            min={0}
            max={100}
            step={1}
            className={`${inputBase} ${inputNormal}`}
            required
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            0 = כל השחקנים זכאים ללא תלות בנוכחות
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="roundCount" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            חלון סבבים
          </label>
          <input
            id="roundCount"
            type="number"
            name="roundCount"
            defaultValue={defaultRoundCount}
            min={0}
            step={1}
            className={`${inputBase} ${inputNormal}`}
            required
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            0 = כל הזמן
          </p>
        </div>
      </div>

      {/* Prize */}
      <div className="flex flex-col gap-1">
        <label htmlFor="prize" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          פרס{" "}
          <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">(אופציונלי)</span>
        </label>
        <input
          id="prize"
          type="text"
          name="prize"
          defaultValue={defaultPrize}
          maxLength={200}
          placeholder="למשל: גאווה נצחית"
          className={`${inputBase} ${inputNormal}`}
        />
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
