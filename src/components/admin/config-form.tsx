"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import {
  updateConfigAction,
  fetchWaGroupsAction,
  runAutoCreateAction,
  type ConfigActionState,
  type WaGroup,
} from "@/app/admin/(protected)/config/actions";
import { HourlyRateDeleteButton } from "@/components/admin/hourly-rate-delete-button";
import { useToast, Toast } from "@/components/ui/toast";
import { CONFIG } from "@/lib/config-keys";
import type { ConfigKey } from "@/lib/config-keys";
import { parseRegulationsTemplate } from "@/lib/regulations-renderer";
import { RegulationsContent } from "@/components/regulations-overlay";

type HourlyRate = { id: string; effectiveFrom: Date; pricePerHour: number };

type Props = {
  values: Record<ConfigKey, string>;
  rates: HourlyRate[];
  currentRateId: string | null;
};

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
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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

function formatRateDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function formatRatePrice(p: number): string {
  return `₪${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}`;
}

const initialState: ConfigActionState = { ok: false };

const SYNTAX_ITEMS = [
  { syntax: "## כותרת ראשית", desc: "כותרת סעיף גדולה" },
  { syntax: "### כותרת משנה", desc: "כותרת סעיף קטנה" },
  { syntax: "**טקסט**", desc: "טקסט מודגש" },
  { syntax: "- פריט", desc: "פריט ברשימה (שורות עוקבות יוצרות רשימה)" },
  { syntax: "(שורה ריקה)", desc: "מעבר פסקה" },
];

const MACRO_ITEMS = [
  { macro: "match_win_score", desc: "נקודות לניצחון" },
  { macro: "match_duration_min", desc: "דקות למשחק" },
  { macro: "fouls_until_penalty", desc: "עבירות קבוצה עד עונשין" },
  { macro: "debt_threshold", desc: "סף חוב (₪)" },
  { macro: "rsvp_close_hours", desc: "שעות לסגירת הרשמה" },
  { macro: "session_schedule_day_name", desc: "יום המפגש (עברית)" },
  { macro: "session_schedule_time", desc: "שעת המפגש" },
  { macro: "fine_no_show", desc: "קנס אי-הגעה (נקודות)" },
  { macro: "fine_kick_ball", desc: "קנס בעיטה בכדור (נקודות)" },
  { macro: "fine_early_leave", desc: "קנס עזיבה מוקדמת (נקודות)" },
];

function RegulationsMacroHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 self-start rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-400 text-[10px] font-bold leading-none dark:border-zinc-500">?</span>
        תחביר ומשתנים
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Overlay panel */}
          <div className="absolute left-0 top-8 z-50 w-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:w-96">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">תחביר ומשתנים</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="סגור"
              >
                ✕
              </button>
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">תחביר עיצוב</p>
            <div className="mb-4 flex flex-col gap-1.5">
              {SYNTAX_ITEMS.map(({ syntax, desc }) => (
                <div key={syntax} className="flex items-start gap-2">
                  <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{syntax}</code>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</span>
                </div>
              ))}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">משתנים זמינים</p>
            <div className="flex flex-col gap-1.5">
              {MACRO_ITEMS.map(({ macro, desc }) => (
                <div key={macro} className="flex items-start gap-2">
                  <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{`{${macro}}`}</code>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ConfigForm({ values, rates, currentRateId }: Props) {
  const [state, formAction, pending] = useActionState(updateConfigAction, initialState);
  const errors = state.ok ? {} : (state.errors ?? {});
  // isDirty: counts changes vs saves to avoid calling setState inside an effect.
  const [changeCount, setChangeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const isDirty = changeCount > saveCount;
  // markDirty is called by onChange / JID picker to record a user change
  const markDirty = () => setChangeCount((n) => n + 1);

  const [ratesHistoryOpen, setRatesHistoryOpen] = useState(false);
  const [runNowPending, startRunNowTransition] = useTransition();
  function handleRunNow() {
    startRunNowTransition(async () => {
      const result = await runAutoCreateAction();
      showToast(result.message, result.ok);
    });
  }
  const { showToast, dismiss, toast } = useToast();

  useEffect(() => {
    if (state.message) {
      showToast(state.message, state.ok);
      if (state.ok) {
        setSaveCount((n) => n + 1); // eslint-disable-line react-hooks/set-state-in-effect
      }
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const [dayValue, setDayValue] = useState(values[CONFIG.SESSION_SCHEDULE_DAY]);
  const [regulationsText, setRegulationsText] = useState(values[CONFIG.REGULATIONS_TEXT]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [groupJidValue, setGroupJidValue] = useState(values[CONFIG.WA_GROUP_JID]);
  const [waGroups, setWaGroups] = useState<WaGroup[] | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");

  async function handleFetchGroups() {
    setGroupsLoading(true);
    setGroupsError("");
    setGroupsOpen(true);
    const result = await fetchWaGroupsAction();
    setGroupsLoading(false);
    if (result.ok) {
      setWaGroups(result.groups);
      setGroupFilter("");
    } else {
      setGroupsError(result.message);
    }
  }

  return (
    <form action={formAction} onChange={() => markDirty()} className="flex flex-col gap-8">
      {/* ── Sessions ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>מפגשים</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="יום ברירת מחדל" htmlFor={CONFIG.SESSION_SCHEDULE_DAY} error={errors[CONFIG.SESSION_SCHEDULE_DAY]}>
            <select
              id={CONFIG.SESSION_SCHEDULE_DAY}
              name={CONFIG.SESSION_SCHEDULE_DAY}
              value={dayValue}
              onChange={(e) => setDayValue(e.target.value)}
              className={`${inputBase} ${errors[CONFIG.SESSION_SCHEDULE_DAY] ? inputError : inputNormal}`}
            >
              {DAYS.map((day, i) => (
                <option key={i} value={String(i)}>
                  {day}
                </option>
              ))}
            </select>
          </Field>

          <Field label="שעת התחלה" hint="HH:MM" htmlFor={CONFIG.SESSION_SCHEDULE_TIME} error={errors[CONFIG.SESSION_SCHEDULE_TIME]}>
            <input
              id={CONFIG.SESSION_SCHEDULE_TIME}
              type="time"
              name={CONFIG.SESSION_SCHEDULE_TIME}
              defaultValue={values[CONFIG.SESSION_SCHEDULE_TIME]}
              className={`${inputBase} ${errors[CONFIG.SESSION_SCHEDULE_TIME] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="משך מפגש" hint="דקות" htmlFor={CONFIG.SESSION_DEFAULT_DURATION_MIN} error={errors[CONFIG.SESSION_DEFAULT_DURATION_MIN]}>
            <input
              id={CONFIG.SESSION_DEFAULT_DURATION_MIN}
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
            htmlFor={CONFIG.RSVP_CLOSE_HOURS}
            error={errors[CONFIG.RSVP_CLOSE_HOURS]}
          >
            <input
              id={CONFIG.RSVP_CLOSE_HOURS}
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

      {/* ── Schedule ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>לוח זמנים</SectionTitle>

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name={CONFIG.SESSION_SCHEDULE_ENABLED}
            value="true"
            defaultChecked={values[CONFIG.SESSION_SCHEDULE_ENABLED] === "true"}
            className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
          />
          הפעל יצירת מפגשים אוטומטית
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="שעות לפני המפגש לפתיחת הרשמה"
            hint="1–168"
            htmlFor={CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE}
            error={errors[CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE]}
          >
            <input
              id={CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE}
              type="number"
              name={CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE}
              defaultValue={values[CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE]}
              min={1}
              max={168}
              className={`${inputBase} ${errors[CONFIG.SESSION_AUTO_CREATE_HOURS_BEFORE] ? inputError : inputNormal}`}
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={handleRunNow}
          disabled={runNowPending}
          className="flex items-center gap-2 self-start rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {runNowPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          הרץ עכשיו
        </button>
      </section>

      {/* ── Location ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>מיקום ברירת מחדל</SectionTitle>

        <Field label="שם המיקום" htmlFor={CONFIG.LOCATION_NAME} error={errors[CONFIG.LOCATION_NAME]}>
          <input
            id={CONFIG.LOCATION_NAME}
            type="text"
            name={CONFIG.LOCATION_NAME}
            defaultValue={values[CONFIG.LOCATION_NAME]}
            maxLength={200}
            className={`${inputBase} ${errors[CONFIG.LOCATION_NAME] ? inputError : inputNormal}`}
            placeholder="שם המגרש / הכתובת"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="קו רוחב (Latitude)" hint="אופציונלי" htmlFor={CONFIG.LOCATION_LAT} error={errors[CONFIG.LOCATION_LAT]}>
            <input
              id={CONFIG.LOCATION_LAT}
              type="text"
              inputMode="decimal"
              name={CONFIG.LOCATION_LAT}
              defaultValue={values[CONFIG.LOCATION_LAT]}
              className={`${inputBase} ${errors[CONFIG.LOCATION_LAT] ? inputError : inputNormal}`}
              placeholder="32.3214"
            />
          </Field>

          <Field label="קו אורך (Longitude)" hint="אופציונלי" htmlFor={CONFIG.LOCATION_LNG} error={errors[CONFIG.LOCATION_LNG]}>
            <input
              id={CONFIG.LOCATION_LNG}
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

      {/* ── Players ─────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>שחקנים</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="דירוג ברירת מחדל"
            hint="לשחקנים ללא דירוג, 1–100"
            htmlFor={CONFIG.DEFAULT_PLAYER_RANK}
            error={errors[CONFIG.DEFAULT_PLAYER_RANK]}
          >
            <input
              id={CONFIG.DEFAULT_PLAYER_RANK}
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
          <Field label="ניקוד ניצחון" hint="נקודות לסיום משחק" htmlFor={CONFIG.MATCH_WIN_SCORE} error={errors[CONFIG.MATCH_WIN_SCORE]}>
            <input
              id={CONFIG.MATCH_WIN_SCORE}
              type="number"
              name={CONFIG.MATCH_WIN_SCORE}
              defaultValue={values[CONFIG.MATCH_WIN_SCORE]}
              min={1}
              max={100}
              className={`${inputBase} ${errors[CONFIG.MATCH_WIN_SCORE] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="משך משחק" hint="דקות לסיום משחק" htmlFor={CONFIG.MATCH_DURATION_MIN} error={errors[CONFIG.MATCH_DURATION_MIN]}>
            <input
              id={CONFIG.MATCH_DURATION_MIN}
              type="number"
              name={CONFIG.MATCH_DURATION_MIN}
              defaultValue={values[CONFIG.MATCH_DURATION_MIN]}
              min={1}
              max={60}
              className={`${inputBase} ${errors[CONFIG.MATCH_DURATION_MIN] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="עבירות קבוצה עד עונשין" hint="מספר עבירות" htmlFor={CONFIG.FOULS_UNTIL_PENALTY} error={errors[CONFIG.FOULS_UNTIL_PENALTY]}>
            <input
              id={CONFIG.FOULS_UNTIL_PENALTY}
              type="number"
              name={CONFIG.FOULS_UNTIL_PENALTY}
              defaultValue={values[CONFIG.FOULS_UNTIL_PENALTY]}
              min={1}
              max={20}
              className={`${inputBase} ${errors[CONFIG.FOULS_UNTIL_PENALTY] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── Precedence fines ────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>קנסות עדיפות</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="אי-הגעה לאחר הרשמה" hint="נקודות" htmlFor={CONFIG.FINE_NO_SHOW} error={errors[CONFIG.FINE_NO_SHOW]}>
            <input
              id={CONFIG.FINE_NO_SHOW}
              type="number"
              name={CONFIG.FINE_NO_SHOW}
              defaultValue={values[CONFIG.FINE_NO_SHOW]}
              min={0}
              max={100}
              className={`${inputBase} ${errors[CONFIG.FINE_NO_SHOW] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="בעיטה בכדור" hint="נקודות" htmlFor={CONFIG.FINE_KICK_BALL} error={errors[CONFIG.FINE_KICK_BALL]}>
            <input
              id={CONFIG.FINE_KICK_BALL}
              type="number"
              name={CONFIG.FINE_KICK_BALL}
              defaultValue={values[CONFIG.FINE_KICK_BALL]}
              min={0}
              max={100}
              className={`${inputBase} ${errors[CONFIG.FINE_KICK_BALL] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="עזיבה מוקדמת ללא הודעה" hint="נקודות" htmlFor={CONFIG.FINE_EARLY_LEAVE} error={errors[CONFIG.FINE_EARLY_LEAVE]}>
            <input
              id={CONFIG.FINE_EARLY_LEAVE}
              type="number"
              name={CONFIG.FINE_EARLY_LEAVE}
              defaultValue={values[CONFIG.FINE_EARLY_LEAVE]}
              min={0}
              max={100}
              className={`${inputBase} ${errors[CONFIG.FINE_EARLY_LEAVE] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── Dynamic ranking weights ─────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>דירוג שחקנים</SectionTitle>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          משקל כל רכיב בחישוב הדירוג הסופי. הדירוג הסופי מנורמל ל-0–100.
          רכיב עמיתים חל על שחקנים קבועים בלבד. רכיב ניצחונות חל רק על שחקנים שמשחק מספיק משחקים.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="משקל דירוג מנהל" hint="מספר לא שלילי" htmlFor={CONFIG.RANK_WEIGHT_ADMIN} error={errors[CONFIG.RANK_WEIGHT_ADMIN]}>
            <input
              id={CONFIG.RANK_WEIGHT_ADMIN}
              type="number"
              name={CONFIG.RANK_WEIGHT_ADMIN}
              defaultValue={values[CONFIG.RANK_WEIGHT_ADMIN]}
              min={0}
              step={0.1}
              className={`${inputBase} ${errors[CONFIG.RANK_WEIGHT_ADMIN] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="משקל דירוג עמיתים" hint="מספר לא שלילי" htmlFor={CONFIG.RANK_WEIGHT_PEER} error={errors[CONFIG.RANK_WEIGHT_PEER]}>
            <input
              id={CONFIG.RANK_WEIGHT_PEER}
              type="number"
              name={CONFIG.RANK_WEIGHT_PEER}
              defaultValue={values[CONFIG.RANK_WEIGHT_PEER]}
              min={0}
              step={0.1}
              className={`${inputBase} ${errors[CONFIG.RANK_WEIGHT_PEER] ? inputError : inputNormal}`}
            />
          </Field>

          <Field label="משקל יחס ניצחונות" hint="מספר לא שלילי" htmlFor={CONFIG.RANK_WEIGHT_WINLOSS} error={errors[CONFIG.RANK_WEIGHT_WINLOSS]}>
            <input
              id={CONFIG.RANK_WEIGHT_WINLOSS}
              type="number"
              name={CONFIG.RANK_WEIGHT_WINLOSS}
              defaultValue={values[CONFIG.RANK_WEIGHT_WINLOSS]}
              min={0}
              step={0.1}
              className={`${inputBase} ${errors[CONFIG.RANK_WEIGHT_WINLOSS] ? inputError : inputNormal}`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="סף משחקים מינימלי לניצחונות" hint="% ממקסימום המשחקים שמישהו שיחק" htmlFor={CONFIG.RANK_WINLOSS_MIN_GAMES_PCT} error={errors[CONFIG.RANK_WINLOSS_MIN_GAMES_PCT]}>
            <input
              id={CONFIG.RANK_WINLOSS_MIN_GAMES_PCT}
              type="number"
              name={CONFIG.RANK_WINLOSS_MIN_GAMES_PCT}
              defaultValue={values[CONFIG.RANK_WINLOSS_MIN_GAMES_PCT]}
              min={0}
              max={100}
              className={`${inputBase} ${errors[CONFIG.RANK_WINLOSS_MIN_GAMES_PCT] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── Regulations ─────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>תקנון</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="גרסת תקנון"
            hint="הגדל ב-1 כדי לאלץ אישור מחדש מכל השחקנים"
            htmlFor={CONFIG.REGULATIONS_VERSION}
            error={errors[CONFIG.REGULATIONS_VERSION]}
          >
            <input
              id={CONFIG.REGULATIONS_VERSION}
              type="number"
              name={CONFIG.REGULATIONS_VERSION}
              defaultValue={values[CONFIG.REGULATIONS_VERSION]}
              min={1}
              className={`${inputBase} ${errors[CONFIG.REGULATIONS_VERSION] ? inputError : inputNormal}`}
            />
          </Field>
        </div>

        <Field
          label="טקסט התקנון"
          htmlFor={CONFIG.REGULATIONS_TEXT}
          error={errors[CONFIG.REGULATIONS_TEXT]}
        >
          <RegulationsMacroHelp />
          <textarea
            id={CONFIG.REGULATIONS_TEXT}
            name={CONFIG.REGULATIONS_TEXT}
            value={regulationsText}
            onChange={(e) => setRegulationsText(e.target.value)}
            rows={20}
            maxLength={10000}
            className={`${inputBase} resize-y font-mono text-sm ${errors[CONFIG.REGULATIONS_TEXT] ? inputError : inputNormal}`}
          />
        </Field>

        {/* Preview toggle */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="flex items-center gap-1.5 self-start rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {previewOpen ? "הסתר תצוגה מקדימה" : "תצוגה מקדימה"}
          </button>
          {previewOpen && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-950 px-5 py-5 dark:border-zinc-700">
              <RegulationsContent
                blocks={parseRegulationsTemplate(regulationsText, { ...values, [CONFIG.SESSION_SCHEDULE_DAY]: dayValue })}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Hourly rates (outside the form submit — links + delete) ── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>תעריף שעתי</SectionTitle>

        {rates.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">לא הוגדרו תעריפים עדיין</p>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Current rate — always visible */}
            {rates.filter((r) => r.id === currentRateId).map((rate) => (
              <div
                key={rate.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950/30"
              >
                <div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatRatePrice(rate.pricePerHour)} / שעה
                  </span>
                  <span className="mr-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-green-500">
                    נוכחי
                  </span>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    מ-{formatRateDate(rate.effectiveFrom)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/config/rates/${rate.id}/edit`}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
                  >
                    ערוך
                  </Link>
                  <HourlyRateDeleteButton id={rate.id} />
                </div>
              </div>
            ))}

            {/* Historical rates — collapsible */}
            {rates.filter((r) => r.id !== currentRateId).length > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setRatesHistoryOpen((v) => !v)}
                  className="flex items-center gap-1.5 self-start text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {ratesHistoryOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {ratesHistoryOpen ? "הסתר היסטוריה" : `הצג היסטוריה (${rates.filter((r) => r.id !== currentRateId).length})`}
                </button>

                {ratesHistoryOpen && rates.filter((r) => r.id !== currentRateId).map((rate) => (
                  <div
                    key={rate.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/40"
                  >
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatRatePrice(rate.pricePerHour)} / שעה
                      </span>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        מ-{formatRateDate(rate.effectiveFrom)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/config/rates/${rate.id}/edit`}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
                      >
                        ערוך
                      </Link>
                      <HourlyRateDeleteButton id={rate.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <Link
            href="/admin/config/rates/new"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
          >
            <Plus className="h-4 w-4" aria-hidden />
            הוסף תעריף
          </Link>
        </div>
      </section>

      {/* ── Charging ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>חיוב</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="מינימום משתתפים" hint="מפגש לא יחויב אם יש פחות מכמות זו" htmlFor={CONFIG.SESSION_MIN_PLAYERS} error={errors[CONFIG.SESSION_MIN_PLAYERS]}>
            <input
              id={CONFIG.SESSION_MIN_PLAYERS}
              type="number"
              name={CONFIG.SESSION_MIN_PLAYERS}
              defaultValue={values[CONFIG.SESSION_MIN_PLAYERS]}
              min={1}
              className={`${inputBase} ${errors[CONFIG.SESSION_MIN_PLAYERS] ? inputError : inputNormal}`}
            />
          </Field>

          <Field
            label="סף חוב"
            hint="₪ — מעל סף זה שחקן קבוע מחויב כמזדמן"
            htmlFor={CONFIG.DEBT_THRESHOLD}
            error={errors[CONFIG.DEBT_THRESHOLD]}
          >
            <input
              id={CONFIG.DEBT_THRESHOLD}
              type="number"
              name={CONFIG.DEBT_THRESHOLD}
              defaultValue={values[CONFIG.DEBT_THRESHOLD]}
              min={0}
              className={`${inputBase} ${errors[CONFIG.DEBT_THRESHOLD] ? inputError : inputNormal}`}
            />
          </Field>
        </div>
      </section>

      {/* ── WhatsApp ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>וואטסאפ</SectionTitle>

        <div className="flex flex-col gap-1">
          <label htmlFor={CONFIG.WA_GROUP_JID} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            מזהה קבוצה (Group JID)
            <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
              (XXXXXXXXXX@g.us — הבוט חייב להיות חבר בקבוצה)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              id={CONFIG.WA_GROUP_JID}
              type="text"
              name={CONFIG.WA_GROUP_JID}
              value={groupJidValue}
              onChange={(e) => setGroupJidValue(e.target.value)}
              maxLength={50}
              placeholder="1234567890-1234567890@g.us"
              className={`flex-1 ${inputBase} ${errors[CONFIG.WA_GROUP_JID] ? inputError : inputNormal}`}
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleFetchGroups}
              disabled={groupsLoading}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {groupsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Search className="h-4 w-4" aria-hidden />
              )}
              חפש קבוצה
            </button>
          </div>
          {errors[CONFIG.WA_GROUP_JID] && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {errors[CONFIG.WA_GROUP_JID]}
            </p>
          )}
          {groupsOpen && (
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              {groupsError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{groupsError}</p>
              ) : waGroups ? (
                <>
                  <input
                    type="text"
                    placeholder="סנן לפי שם…"
                    aria-label="סנן קבוצות לפי שם"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className={`${inputBase} ${inputNormal} text-sm`}
                    autoFocus
                  />
                  <ul className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                    {waGroups
                      .filter((g) =>
                        g.subject.toLowerCase().includes(groupFilter.toLowerCase()),
                      )
                      .map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setGroupJidValue(g.id);
                              markDirty();
                              setGroupsOpen(false);
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-right hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                              {g.subject}
                            </span>
                            <span
                              className="text-xs text-zinc-400 dark:text-zinc-500"
                              dir="ltr"
                            >
                              {g.id}
                            </span>
                          </button>
                        </li>
                      ))}
                    {waGroups.filter((g) =>
                      g.subject.toLowerCase().includes(groupFilter.toLowerCase()),
                    ).length === 0 && (
                      <li className="px-2 py-1.5 text-sm text-zinc-400 dark:text-zinc-500">
                        לא נמצאו קבוצות
                      </li>
                    )}
                  </ul>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Session open */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name={CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED}
              value="true"
              defaultChecked={values[CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED] === "true"}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            התראה על פתיחת מפגש (לקבוצה)
          </label>
          <Field label="תבנית הודעה" htmlFor={CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE} error={errors[CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE]}>
            <textarea
              id={CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE}
              name={CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE}
              defaultValue={values[CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE]}
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-y ${errors[CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE] ? inputError : inputNormal}`}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">משתנים זמינים: {"{date}"}</p>
          </Field>
        </div>

        {/* Session close */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name={CONFIG.WA_NOTIFY_SESSION_CLOSE_ENABLED}
              value="true"
              defaultChecked={values[CONFIG.WA_NOTIFY_SESSION_CLOSE_ENABLED] === "true"}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            התראה על סגירת מפגש (לקבוצה)
          </label>
          <Field label="תבנית הודעה" htmlFor={CONFIG.WA_NOTIFY_SESSION_CLOSE_TEMPLATE} error={errors[CONFIG.WA_NOTIFY_SESSION_CLOSE_TEMPLATE]}>
            <textarea
              id={CONFIG.WA_NOTIFY_SESSION_CLOSE_TEMPLATE}
              name={CONFIG.WA_NOTIFY_SESSION_CLOSE_TEMPLATE}
              defaultValue={values[CONFIG.WA_NOTIFY_SESSION_CLOSE_TEMPLATE]}
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-y ${errors[CONFIG.WA_NOTIFY_SESSION_CLOSE_TEMPLATE] ? inputError : inputNormal}`}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">משתנים זמינים: {"{date}"}</p>
          </Field>
        </div>

        {/* Player registered */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name={CONFIG.WA_NOTIFY_PLAYER_REGISTERED_ENABLED}
              value="true"
              defaultChecked={values[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_ENABLED] === "true"}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            התראה על רישום שחקן (לקבוצה)
          </label>
          <Field label="תבנית הודעה" htmlFor={CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE} error={errors[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE]}>
            <textarea
              id={CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE}
              name={CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE}
              defaultValue={values[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE]}
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-y ${errors[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE] ? inputError : inputNormal}`}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              משתנים זמינים: {"{date}"}, {"{player_name}"}, {"{status}"}
            </p>
          </Field>
        </div>

        {/* Player cancelled */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name={CONFIG.WA_NOTIFY_PLAYER_CANCELLED_ENABLED}
              value="true"
              defaultChecked={values[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_ENABLED] === "true"}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            התראה על ביטול רישום שחקן (לקבוצה)
          </label>
          <Field label="תבנית הודעה" htmlFor={CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE} error={errors[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE]}>
            <textarea
              id={CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE}
              name={CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE}
              defaultValue={values[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE]}
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-y ${errors[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE] ? inputError : inputNormal}`}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              משתנים זמינים: {"{date}"}, {"{player_name}"}
            </p>
          </Field>
        </div>

        {/* Waitlist promote */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name={CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_ENABLED}
              value="true"
              defaultChecked={values[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_ENABLED] === "true"}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            התראה על קידום מרשימת המתנה (הודעה ישירה לשחקן)
          </label>
          <Field label="תבנית הודעה" htmlFor={CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE} error={errors[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE]}>
            <textarea
              id={CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE}
              name={CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE}
              defaultValue={values[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE]}
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-y ${errors[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE] ? inputError : inputNormal}`}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              משתנים זמינים: {"{date}"}, {"{player_name}"}
            </p>
          </Field>
        </div>
      </section>

      {/* ── Low-Attendance Alerts ───────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionTitle>התראות נוכחות נמוכה</SectionTitle>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          שליחה אוטומטית לקבוצת הוואטסאפ כשמספר הנרשמים נמוך ממינימום הנדרש לפני המפגש.
        </p>

        {/* Master toggle */}
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            name={CONFIG.ALERT_LOW_ATTENDANCE_ENABLED}
            value="true"
            defaultChecked={values[CONFIG.ALERT_LOW_ATTENDANCE_ENABLED] === "true"}
            className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
          />
          הפעל התראות נוכחות נמוכה
        </label>

        {/* Early alert */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              name={CONFIG.ALERT_EARLY_ENABLED}
              value="true"
              defaultChecked={values[CONFIG.ALERT_EARLY_ENABLED] === "true"}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            התראה מוקדמת
          </label>
          <Field label="שעות לפני המפגש" htmlFor={CONFIG.ALERT_EARLY_HOURS_BEFORE} error={errors[CONFIG.ALERT_EARLY_HOURS_BEFORE]}>
            <input
              id={CONFIG.ALERT_EARLY_HOURS_BEFORE}
              name={CONFIG.ALERT_EARLY_HOURS_BEFORE}
              type="number"
              min="1"
              defaultValue={values[CONFIG.ALERT_EARLY_HOURS_BEFORE]}
              className={`${inputBase} w-24 ${errors[CONFIG.ALERT_EARLY_HOURS_BEFORE] ? inputError : inputNormal}`}
            />
          </Field>
          <Field label="תבנית הודעה" htmlFor={CONFIG.ALERT_EARLY_TEMPLATE} error={errors[CONFIG.ALERT_EARLY_TEMPLATE]}>
            <textarea
              id={CONFIG.ALERT_EARLY_TEMPLATE}
              name={CONFIG.ALERT_EARLY_TEMPLATE}
              defaultValue={values[CONFIG.ALERT_EARLY_TEMPLATE]}
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-y ${errors[CONFIG.ALERT_EARLY_TEMPLATE] ? inputError : inputNormal}`}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              משתנים זמינים: {"{date}"}, {"{confirmed}"}, {"{min_players}"}
            </p>
          </Field>
        </div>

        {/* Critical alert */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              name={CONFIG.ALERT_CRITICAL_ENABLED}
              value="true"
              defaultChecked={values[CONFIG.ALERT_CRITICAL_ENABLED] === "true"}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            התראה קריטית
          </label>
          <Field label="שעות לפני המפגש" htmlFor={CONFIG.ALERT_CRITICAL_HOURS_BEFORE} error={errors[CONFIG.ALERT_CRITICAL_HOURS_BEFORE]}>
            <input
              id={CONFIG.ALERT_CRITICAL_HOURS_BEFORE}
              name={CONFIG.ALERT_CRITICAL_HOURS_BEFORE}
              type="number"
              min="1"
              defaultValue={values[CONFIG.ALERT_CRITICAL_HOURS_BEFORE]}
              className={`${inputBase} w-24 ${errors[CONFIG.ALERT_CRITICAL_HOURS_BEFORE] ? inputError : inputNormal}`}
            />
          </Field>
          <Field label="תבנית הודעה" htmlFor={CONFIG.ALERT_CRITICAL_TEMPLATE} error={errors[CONFIG.ALERT_CRITICAL_TEMPLATE]}>
            <textarea
              id={CONFIG.ALERT_CRITICAL_TEMPLATE}
              name={CONFIG.ALERT_CRITICAL_TEMPLATE}
              defaultValue={values[CONFIG.ALERT_CRITICAL_TEMPLATE]}
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-y ${errors[CONFIG.ALERT_CRITICAL_TEMPLATE] ? inputError : inputNormal}`}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              משתנים זמינים: {"{date}"}, {"{confirmed}"}, {"{min_players}"}
            </p>
          </Field>
        </div>
      </section>

      {/* ── Submit ──────────────────────────────────────── */}
      <button
        type="submit"
        disabled={pending || !isDirty}
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
      <Toast toast={toast} onDismiss={dismiss} />
    </form>
  );
}
