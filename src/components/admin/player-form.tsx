"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2 } from "lucide-react";
import {
  createPlayerAction,
  updatePlayerAction,
  type PlayerActionState,
} from "@/app/admin/(protected)/players/actions";
import { parsePlayerForm, POSITION_VALUES, type PositionValue } from "@/lib/player-validation";

type PlayerData = {
  id: string;
  phone: string;
  playerKind: "REGISTERED" | "DROP_IN";
  positions: ("PG" | "SG" | "SF" | "PF" | "C")[];
  rank: number | null;
  isAdmin: boolean;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  birthdate: Date | null;
};

type Props =
  | { mode: "create" }
  | { mode: "edit"; player: PlayerData };

const initialState: PlayerActionState = { ok: false };

const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";
const inputBase =
  "rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputDisabled =
  "cursor-not-allowed opacity-60 bg-zinc-50 dark:bg-zinc-800";

function formatIsraeliDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${parseInt(day)}.${parseInt(month)}.${year}`;
}

function parseIsraeliDate(text: string): string | null {
  const m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function PlayerForm(props: Props) {
  const isEdit = props.mode === "edit";
  const player = isEdit ? props.player : null;
  const router = useRouter();

  const action = isEdit
    ? updatePlayerAction.bind(null, player!.id)
    : createPlayerAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  const [phone, setPhone] = useState(player?.phone ?? "");
  const [playerKind, setPlayerKind] = useState<"REGISTERED" | "DROP_IN">(
    player?.playerKind ?? "DROP_IN",
  );
  const [positions, setPositions] = useState<PositionValue[]>(player?.positions ?? []);
  const [rank, setRank] = useState(player?.rank != null ? String(player.rank) : "");
  const [isAdmin, setIsAdmin] = useState(player?.isAdmin ?? false);
  const [nickname, setNickname] = useState(player?.nickname ?? "");
  const [firstNameHe, setFirstNameHe] = useState(player?.firstNameHe ?? "");
  const [lastNameHe, setLastNameHe] = useState(player?.lastNameHe ?? "");
  const [firstNameEn, setFirstNameEn] = useState(player?.firstNameEn ?? "");
  const [lastNameEn, setLastNameEn] = useState(player?.lastNameEn ?? "");

  const [birthdate, setBirthdate] = useState(
    player?.birthdate ? new Date(player.birthdate).toISOString().slice(0, 10) : "",
  );
  const [birthdateDisplay, setBirthdateDisplay] = useState(
    player?.birthdate ? formatIsraeliDate(new Date(player.birthdate).toISOString().slice(0, 10)) : "",
  );
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const [suppressServerError, setSuppressServerError] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  // Custom confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Track which submit button was clicked so we show the spinner on the right one
  const [submittingButton, setSubmittingButton] = useState<"save" | "return" | null>(null);

  // Dirty tracking
  const lastSavedRef = useRef({
    playerKind: player?.playerKind ?? "DROP_IN",
    positions: [...(player?.positions ?? [])] as PositionValue[],
    rank: player?.rank != null ? String(player.rank) : "",
    isAdmin: player?.isAdmin ?? false,
    nickname: player?.nickname ?? "",
    firstNameHe: player?.firstNameHe ?? "",
    lastNameHe: player?.lastNameHe ?? "",
    firstNameEn: player?.firstNameEn ?? "",
    lastNameEn: player?.lastNameEn ?? "",
    birthdate: player?.birthdate ? new Date(player.birthdate).toISOString().slice(0, 10) : "",
  });
  const [, setDirtyVersion] = useState(0);

  const s = lastSavedRef.current;
  const isDirty = isEdit
    ? (
      playerKind !== s.playerKind ||
      positions.length !== s.positions.length ||
      positions.some((p) => !s.positions.includes(p)) ||
      rank !== s.rank ||
      isAdmin !== s.isAdmin ||
      nickname !== s.nickname ||
      firstNameHe !== s.firstNameHe ||
      lastNameHe !== s.lastNameHe ||
      firstNameEn !== s.firstNameEn ||
      lastNameEn !== s.lastNameEn ||
      birthdate !== s.birthdate
    )
    : (
      phone !== "" ||
      playerKind !== "DROP_IN" ||
      positions.length > 0 ||
      rank !== "" ||
      isAdmin !== false ||
      nickname !== "" ||
      firstNameHe !== "" ||
      lastNameHe !== "" ||
      firstNameEn !== "" ||
      lastNameEn !== "" ||
      birthdate !== ""
    );

  // Keep a ref so popstate handler always reads current value
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // beforeunload guard (covers refresh / close tab / address bar navigation)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // popstate guard (covers mobile browser back button / soft navigation back)
  useEffect(() => {
    history.pushState(null, "", window.location.href);
    const handler = () => {
      if (isDirtyRef.current) {
        history.pushState(null, "", window.location.href);
        setConfirmOpen(true);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Reset submitting button tracking when the action finishes
  useEffect(() => {
    if (!pending) setSubmittingButton(null);
  }, [pending]);

  // Detect save-in-place success
  const prevStateRef = useRef<PlayerActionState>(initialState);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (!prev.ok && state.ok && state.savedInPlace) {
      lastSavedRef.current = {
        playerKind, positions: [...positions], rank, isAdmin,
        nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn,
        birthdate,
      };
      setDirtyVersion((v) => v + 1);
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const validation = parsePlayerForm({
    phone: isEdit ? (player?.phone ?? "") : phone,
    playerKind,
    positions,
    rank: rank || undefined,
    isAdmin: isAdmin ? "on" : undefined,
    nickname: nickname || undefined,
    firstNameHe: firstNameHe || undefined,
    lastNameHe: lastNameHe || undefined,
    firstNameEn: firstNameEn || undefined,
    lastNameEn: lastNameEn || undefined,
    birthdate: birthdate || undefined,
  });

  const fieldErrors = validation.ok ? {} : validation.errors;
  const phoneError = fieldErrors.phone;
  const rankError = fieldErrors.rank;
  const phoneErrorVisible = !isEdit && phoneBlurred && Boolean(phoneError);

  const formValid = validation.ok;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validation.ok) {
      e.preventDefault();
      setPhoneBlurred(true);
      return;
    }
    setSuppressServerError(false);
  }

  function onFieldChange(setter: (v: string) => void, value: string) {
    setter(value);
    setSuppressServerError(true);
  }

  function handleBack() {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      router.push("/admin/players");
    }
  }

  const serverError =
    !pending && !state.ok && state.message && !suppressServerError
      ? state.message
      : null;

  return (
    <>
      {/* Dirty-leave confirm dialog */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {isEdit ? "יש שינויים שלא נשמרו" : "לנטוש את הטופס?"}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {isEdit ? "האם לעזוב את הדף? השינויים לא יישמרו." : "הפרטים שהזנת לא יישמרו."}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); router.push("/admin/players"); }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:bg-red-700"
              >
                עזוב
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:active:bg-zinc-500"
              >
                המשך עריכה
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        action={formAction}
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-5"
        noValidate
      >
        {/* Back link */}
        <button
          type="button"
          onClick={handleBack}
          className="self-start text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white cursor-pointer"
        >
          → חזרה לרשימה
        </button>

        {/* Phone */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="player-phone"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            טלפון נייד
            {isEdit && (
              <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                (לא ניתן לשינוי)
              </span>
            )}
          </label>
          {isEdit ? (
            <>
              <input
                id="player-phone"
                name="phone"
                type="tel"
                value={player!.phone}
                disabled
                className={`${inputBase} ${inputDisabled} ${inputNormal}`}
              />
              <input type="hidden" name="phone" value={player!.phone} />
            </>
          ) : (
            <>
              <input
                id="player-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => onFieldChange(setPhone, e.target.value)}
                onBlur={() => setPhoneBlurred(true)}
                aria-invalid={phoneErrorVisible}
                aria-describedby={phoneErrorVisible ? "player-phone-error" : undefined}
                className={`${inputBase} ${phoneErrorVisible ? inputInvalid : inputNormal}`}
                placeholder="05xxxxxxxx"
              />
              {phoneErrorVisible && (
                <p id="player-phone-error" className="text-xs text-red-600 dark:text-red-400">
                  {phoneError}
                </p>
              )}
            </>
          )}
        </div>

        {/* Player kind */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="player-kind"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            סוג שחקן
          </label>
          <select
            id="player-kind"
            name="playerKind"
            value={playerKind}
            onChange={(e) => {
              setPlayerKind(e.target.value as "REGISTERED" | "DROP_IN");
              setSuppressServerError(true);
            }}
            className={`${inputBase} ${inputNormal}`}
          >
            <option value="REGISTERED">קבוע</option>
            <option value="DROP_IN">מזדמן</option>
          </select>
        </div>

        {/* Positions */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            עמדות
            <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
              (אופציונלי, ניתן לבחור כמה)
            </span>
          </span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {POSITION_VALUES.map((pos) => (
              <label key={pos} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="positions"
                  value={pos}
                  checked={positions.includes(pos)}
                  onChange={(e) => {
                    setPositions((prev) =>
                      e.target.checked ? [...prev, pos] : prev.filter((p) => p !== pos),
                    );
                    setSuppressServerError(true);
                  }}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
                />
                {pos}
              </label>
            ))}
          </div>
        </div>

        {/* Rank */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="player-rank"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            דירוג
            <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
              (1–100, אופציונלי)
            </span>
          </label>
          <input
            id="player-rank"
            name="rank"
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={rank}
            onChange={(e) => onFieldChange(setRank, e.target.value)}
            aria-invalid={Boolean(rankError)}
            className={`${inputBase} ${rankError ? inputInvalid : inputNormal}`}
            placeholder="לא מוגדר"
          />
          {rankError && (
            <p className="text-xs text-red-600 dark:text-red-400">{rankError}</p>
          )}
        </div>

        {/* isAdmin */}
        <div className="flex items-center gap-3">
          <input
            id="player-is-admin"
            name="isAdmin"
            type="checkbox"
            value="on"
            checked={isAdmin}
            onChange={(e) => {
              setIsAdmin(e.target.checked);
              setSuppressServerError(true);
            }}
            className="h-5 w-5 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
          />
          <label
            htmlFor="player-is-admin"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            הרשאת מנהל
          </label>
        </div>

        {/* Nickname */}
        <div className="flex flex-col gap-1">
          <label htmlFor="player-nickname" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            כינוי
            <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">(לייבוא, אופציונלי)</span>
          </label>
          <input
            id="player-nickname"
            name="nickname"
            type="text"
            maxLength={50}
            value={nickname}
            onChange={(e) => onFieldChange(setNickname, e.target.value)}
            className={`${inputBase} ${inputNormal}`}
            placeholder="כינוי קצר"
          />
        </div>

        {/* Name fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="player-fn-he" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">שם פרטי (עברית)</label>
            <input id="player-fn-he" name="firstNameHe" type="text" maxLength={80} value={firstNameHe}
              onChange={(e) => onFieldChange(setFirstNameHe, e.target.value)}
              className={`${inputBase} ${inputNormal}`} placeholder="שם פרטי" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="player-ln-he" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">שם משפחה (עברית)</label>
            <input id="player-ln-he" name="lastNameHe" type="text" maxLength={80} value={lastNameHe}
              onChange={(e) => onFieldChange(setLastNameHe, e.target.value)}
              className={`${inputBase} ${inputNormal}`} placeholder="שם משפחה" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="player-fn-en" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">First name (English)</label>
            <input id="player-fn-en" name="firstNameEn" type="text" maxLength={80} value={firstNameEn}
              onChange={(e) => onFieldChange(setFirstNameEn, e.target.value)}
              className={`${inputBase} ${inputNormal}`} placeholder="First name" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="player-ln-en" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Last name (English)</label>
            <input id="player-ln-en" name="lastNameEn" type="text" maxLength={80} value={lastNameEn}
              onChange={(e) => onFieldChange(setLastNameEn, e.target.value)}
              className={`${inputBase} ${inputNormal}`} placeholder="Last name" />
          </div>
        </div>

        {/* Birthdate */}
        <div className="flex flex-col gap-1">
          <label htmlFor="player-birthdate-display" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            תאריך לידה
            <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">(אופציונלי)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="player-birthdate-display"
              type="text"
              inputMode="numeric"
              value={birthdateDisplay}
              onChange={(e) => {
                const text = e.target.value;
                setBirthdateDisplay(text);
                const iso = parseIsraeliDate(text);
                if (iso) {
                  onFieldChange(setBirthdate, iso);
                } else if (!text) {
                  onFieldChange(setBirthdate, "");
                }
              }}
              placeholder="d.m.yyyy"
              className={`${inputBase} ${inputNormal} flex-1`}
            />
            <button
              type="button"
              onClick={() => {
                try { hiddenDateRef.current?.showPicker(); }
                catch { hiddenDateRef.current?.focus(); }
              }}
              className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="פתח לוח שנה"
            >
              <Calendar className="h-5 w-5" aria-hidden />
            </button>
            <input
              ref={hiddenDateRef}
              name="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => {
                const val = e.target.value;
                onFieldChange(setBirthdate, val);
                setBirthdateDisplay(val ? formatIsraeliDate(val) : "");
              }}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>

        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
          >
            {serverError}
          </p>
        )}

        {showSaved && (
          <p
            role="status"
            className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
          >
            השינויים נשמרו בהצלחה
          </p>
        )}

        {/* Submit buttons */}
        {isEdit ? (
          <div className="flex gap-3">
            {/* Save & stay — primary, rightmost in RTL (first in DOM) */}
            <button
              type="submit"
              name="returnToList"
              value="false"
              onClick={() => setSubmittingButton("save")}
              disabled={pending || !formValid}
              className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-300/50"
            >
              {pending && submittingButton === "save" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  שומר…
                </>
              ) : (
                "שמור שינויים"
              )}
            </button>
            {/* Save & return — secondary, leftmost in RTL */}
            <button
              type="submit"
              name="returnToList"
              value="true"
              onClick={() => setSubmittingButton("return")}
              disabled={pending || !formValid}
              className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-blue-500 active:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && submittingButton === "return" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  שומר…
                </>
              ) : (
                "שמור וחזור לרשימה"
              )}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={pending || !formValid}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-300/50"
          >
            {pending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                שומר…
              </>
            ) : (
              "צור שחקן"
            )}
          </button>
        )}
      </form>

      {/* Cancel — outside the form to prevent any accidental form submission on mobile */}
      <button
        type="button"
        onClick={handleBack}
        disabled={pending}
        className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-red-500 active:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ביטול
      </button>
    </>
  );
}
