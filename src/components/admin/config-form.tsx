"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateConfigAction, type ConfigActionState } from "@/app/admin/(protected)/config/actions";
import { CONFIG } from "@/lib/config-keys";
import type { ConfigKey } from "@/lib/config-keys";

type Props = { values: Record<ConfigKey, string> };

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const inputBase =
  "rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputError =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      {children}
    </h2>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {hint && (
          <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
            ({hint})
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

const initialState: ConfigActionState = { ok: false };

export function ConfigForm({ values }: Props) {
  const [state, formAction, pending] = useActionState(updateConfigAction, initialState);
  const errors = state.ok ? {} : (state.errors ?? {});

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* ── Sessions ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>מפגשים</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="יום ברירת מחדל" error={errors[CONFIG.SESSION_DEFAULT_DAY]}>
            <select
              name={CONFIG.SESSION_DEFAULT_DAY}
              defaultValue={values[CONFIG.SESSION_DEFAULT_DAY]}
              className={`${inputBase} ${errors[CONFIG.SESSION_DEFAULT_DAY] ? inputError : inputNormal}`}
            >
              {DAYS.map((day, i) => (
                <option key={i} value={String(i)}>
                  {day}
                </option>
              ))}
            </select>
          </Field>

          <Field label="שעת התחלה" hint="HH:MM" error={errors[CONFIG.SESSION_DEFAULT_TIME]}>
            <input
              type="time"
              name={CONFIG.SESSION_DEFAULT_TIME}
              defaultValue={values[CONFIG.SESSION_DEFAULT_TIME]}
              className={`${inputBase} ${errors[CONFIG.SESSION_DEFAULT_TIME] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="משך מפגש" hint="דקות" error={errors[CONFIG.SESSION_DEFAULT_DURATION_MIN]}>
            <input
              type="number"
              name={CONFIG.SESSION_DEFAULT_DURATION_MIN}
              defaultValue={values[CONFIG.SESSION_DEFAULT_DURATION_MIN]}
              min={30}
              max={480}
              step={15}
              className={`${inputBase} ${errors[CONFIG.SESSION_DEFAULT_DURATION_MIN] ? inputError : inputNormal}`}
            />
          </Field>

          <Field
            label="חלון הרשמה"
            hint="שעות לפני תחילת המפגש"
            error={errors[CONFIG.RSVP_CLOSE_HOURS]}
          >
            <input
              type="number"
              name={CONFIG.RSVP_CLOSE_HOURS}
              defaultValue={values[CONFIG.RSVP_CLOSE_HOURS]}
              min={0}
              max={72}
              className={`${inputBase} ${errors[CONFIG.RSVP_CLOSE_HOURS] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── Location ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>מיקום ברירת מחדל</SectionTitle>

        <Field label="שם המיקום" error={errors[CONFIG.LOCATION_NAME]}>
          <input
            type="text"
            name={CONFIG.LOCATION_NAME}
            defaultValue={values[CONFIG.LOCATION_NAME]}
            maxLength={200}
            className={`${inputBase} ${errors[CONFIG.LOCATION_NAME] ? inputError : inputNormal}`}
            placeholder="שם המגרש / הכתובת"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="קו רוחב (Latitude)" hint="אופציונלי" error={errors[CONFIG.LOCATION_LAT]}>
            <input
              type="text"
              inputMode="decimal"
              name={CONFIG.LOCATION_LAT}
              defaultValue={values[CONFIG.LOCATION_LAT]}
              className={`${inputBase} ${errors[CONFIG.LOCATION_LAT] ? inputError : inputNormal}`}
              placeholder="32.3214"
            />
          </Field>

          <Field label="קו אורך (Longitude)" hint="אופציונלי" error={errors[CONFIG.LOCATION_LNG]}>
            <input
              type="text"
              inputMode="decimal"
              name={CONFIG.LOCATION_LNG}
              defaultValue={values[CONFIG.LOCATION_LNG]}
              className={`${inputBase} ${errors[CONFIG.LOCATION_LNG] ? inputError : inputNormal}`}
              placeholder="34.8529"
            />
          </Field>
        </div>

        {values[CONFIG.LOCATION_LAT] && values[CONFIG.LOCATION_LNG] && (
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href={`https://www.google.com/maps?q=${values[CONFIG.LOCATION_LAT]},${values[CONFIG.LOCATION_LNG]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Google Maps ↗
            </a>
            <a
              href={`https://waze.com/ul?ll=${values[CONFIG.LOCATION_LAT]},${values[CONFIG.LOCATION_LNG]}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Waze ↗
            </a>
          </div>
        )}
      </section>

      {/* ── Charging ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>חיוב</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="מחיר מזדמן" hint="₪ לכל מפגש" error={errors[CONFIG.DROPIN_CHARGE]}>
            <input
              type="number"
              name={CONFIG.DROPIN_CHARGE}
              defaultValue={values[CONFIG.DROPIN_CHARGE]}
              min={1}
              className={`${inputBase} ${errors[CONFIG.DROPIN_CHARGE] ? inputError : inputNormal}`}
            />
          </Field>

          <Field
            label="סף חוב"
            hint="₪ — מעל סף זה שחקן קבוע מחויב כמזדמן"
            error={errors[CONFIG.DEBT_THRESHOLD]}
          >
            <input
              type="number"
              name={CONFIG.DEBT_THRESHOLD}
              defaultValue={values[CONFIG.DEBT_THRESHOLD]}
              min={0}
              className={`${inputBase} ${errors[CONFIG.DEBT_THRESHOLD] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── Players ─────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>שחקנים</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="דירוג ברירת מחדל"
            hint="לשחקנים ללא דירוג, 1–100"
            error={errors[CONFIG.DEFAULT_PLAYER_RANK]}
          >
            <input
              type="number"
              name={CONFIG.DEFAULT_PLAYER_RANK}
              defaultValue={values[CONFIG.DEFAULT_PLAYER_RANK]}
              min={1}
              max={100}
              className={`${inputBase} ${errors[CONFIG.DEFAULT_PLAYER_RANK] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── Matches ─────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>משחקים</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ניקוד ניצחון" hint="נקודות לסיום משחק" error={errors[CONFIG.MATCH_WIN_SCORE]}>
            <input
              type="number"
              name={CONFIG.MATCH_WIN_SCORE}
              defaultValue={values[CONFIG.MATCH_WIN_SCORE]}
              min={1}
              max={100}
              className={`${inputBase} ${errors[CONFIG.MATCH_WIN_SCORE] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── Feedback ────────────────────────────────────── */}
      {state.ok && state.message && (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
        >
          {state.message}
        </p>
      )}
      {!state.ok && state.message && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {state.message}
        </p>
      )}

      {/* ── Submit ──────────────────────────────────────── */}
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-300/50 sm:w-auto sm:min-w-[14rem]"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            שומר…
          </>
        ) : (
          "שמור הגדרות"
        )}
      </button>
    </form>
  );
}
