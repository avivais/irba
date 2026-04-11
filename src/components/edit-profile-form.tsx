"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2 } from "lucide-react";
import {
  updatePlayerProfileAction,
  type ProfileActionState,
} from "@/app/actions/player-profile";

type PlayerProfile = {
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  birthdate: Date | null;
  nationalId: string | null;
  email: string | null;
};

const initialState: ProfileActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";

function formatIsraeliDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${parseInt(day)}.${parseInt(month)}.${year}`;
}

function parseIsraeliDate(text: string): string | null {
  const m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function LabelText({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </span>
  );
}

function DisplayRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`text-sm ${value ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function EditProfileForm({ player }: { player: PlayerProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const [state, formAction, pending] = useActionState(
    updatePlayerProfileAction,
    initialState,
  );

  // Field state — initialized from player prop
  const [nickname, setNickname] = useState(player.nickname ?? "");
  const [firstNameHe, setFirstNameHe] = useState(player.firstNameHe ?? "");
  const [lastNameHe, setLastNameHe] = useState(player.lastNameHe ?? "");
  const [firstNameEn, setFirstNameEn] = useState(player.firstNameEn ?? "");
  const [lastNameEn, setLastNameEn] = useState(player.lastNameEn ?? "");
  const [email, setEmail] = useState(player.email ?? "");
  const [nationalId, setNationalId] = useState(player.nationalId ?? "");

  const initialIso = player.birthdate
    ? new Date(player.birthdate).toISOString().slice(0, 10)
    : "";
  const [birthdate, setBirthdate] = useState(initialIso);
  const [birthdateDisplay, setBirthdateDisplay] = useState(
    initialIso ? formatIsraeliDate(initialIso) : "",
  );
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  // Detect save success
  const prevStateRef = useRef<ProfileActionState>(initialState);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (!prev.ok && state.ok) {
      setEditing(false);
      setShowSaved(true);
      router.refresh();
      const t = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleCancel() {
    // Reset fields back to current player values
    setNickname(player.nickname ?? "");
    setFirstNameHe(player.firstNameHe ?? "");
    setLastNameHe(player.lastNameHe ?? "");
    setFirstNameEn(player.firstNameEn ?? "");
    setLastNameEn(player.lastNameEn ?? "");
    setEmail(player.email ?? "");
    setNationalId(player.nationalId ?? "");
    const iso = player.birthdate
      ? new Date(player.birthdate).toISOString().slice(0, 10)
      : "";
    setBirthdate(iso);
    setBirthdateDisplay(iso ? formatIsraeliDate(iso) : "");
    setEditing(false);
  }

  const errors = state.errors ?? {};

  // Computed display values (updated after save via router.refresh + re-render from server)
  const displayFirstName =
    firstNameHe && lastNameHe
      ? `${firstNameHe} ${lastNameHe}`
      : firstNameHe || lastNameHe || null;
  const displayFirstNameEn =
    firstNameEn && lastNameEn
      ? `${firstNameEn} ${lastNameEn}`
      : firstNameEn || lastNameEn || null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">פרטים אישיים</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ערוך
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        )}
      </div>

      {/* Card body */}
      {!editing ? (
        /* ── Display mode ── */
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DisplayRow label="שם (עברית)" value={displayFirstName} />
            <DisplayRow label="שם (אנגלית)" value={displayFirstNameEn} />
            <DisplayRow label="כינוי" value={player.nickname} />
            <DisplayRow
              label="תאריך לידה"
              value={
                player.birthdate
                  ? formatIsraeliDate(new Date(player.birthdate).toISOString().slice(0, 10))
                  : null
              }
            />
            <DisplayRow label='ת"ז' value={player.nationalId} />
            <DisplayRow label="מייל" value={player.email} />
          </div>
          {showSaved && (
            <p
              role="status"
              className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
            >
              הפרטים נשמרו בהצלחה
            </p>
          )}
        </div>
      ) : (
        /* ── Edit mode ── */
        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          {/* Hebrew names */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <LabelText>שם פרטי (עברית)</LabelText>
              <input
                name="firstNameHe"
                type="text"
                maxLength={80}
                value={firstNameHe}
                onChange={(e) => setFirstNameHe(e.target.value)}
                className={`${inputBase} ${inputNormal}`}
                placeholder="שם פרטי"
              />
            </div>
            <div className="flex flex-col gap-1">
              <LabelText>שם משפחה (עברית)</LabelText>
              <input
                name="lastNameHe"
                type="text"
                maxLength={80}
                value={lastNameHe}
                onChange={(e) => setLastNameHe(e.target.value)}
                className={`${inputBase} ${inputNormal}`}
                placeholder="שם משפחה"
              />
            </div>
          </div>

          {/* English names */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <LabelText>First name (English)</LabelText>
              <input
                name="firstNameEn"
                type="text"
                maxLength={80}
                value={firstNameEn}
                onChange={(e) => setFirstNameEn(e.target.value)}
                className={`${inputBase} ${inputNormal}`}
                placeholder="First name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <LabelText>Last name (English)</LabelText>
              <input
                name="lastNameEn"
                type="text"
                maxLength={80}
                value={lastNameEn}
                onChange={(e) => setLastNameEn(e.target.value)}
                className={`${inputBase} ${inputNormal}`}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Nickname */}
          <div className="flex flex-col gap-1">
            <LabelText>כינוי</LabelText>
            <input
              name="nickname"
              type="text"
              maxLength={50}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={`${inputBase} ${errors.nickname ? inputInvalid : inputNormal}`}
              placeholder="כינוי קצר (אופציונלי)"
            />
            {errors.nickname && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.nickname}</p>
            )}
          </div>

          {/* Birthdate */}
          <div className="flex flex-col gap-1">
            <LabelText>תאריך לידה</LabelText>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={birthdateDisplay}
                onChange={(e) => {
                  const text = e.target.value;
                  setBirthdateDisplay(text);
                  const iso = parseIsraeliDate(text);
                  if (iso) setBirthdate(iso);
                  else if (!text) setBirthdate("");
                }}
                placeholder="d.m.yyyy"
                className={`${inputBase} ${errors.birthdate ? inputInvalid : inputNormal} flex-1`}
              />
              <button
                type="button"
                onClick={() => {
                  try { hiddenDateRef.current?.showPicker(); }
                  catch { hiddenDateRef.current?.focus(); }
                }}
                className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
                  setBirthdate(val);
                  setBirthdateDisplay(val ? formatIsraeliDate(val) : "");
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
            {errors.birthdate && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.birthdate}</p>
            )}
          </div>

          {/* National ID */}
          <div className="flex flex-col gap-1">
            <LabelText>תעודת זהות</LabelText>
            <input
              name="nationalId"
              type="text"
              inputMode="numeric"
              maxLength={11}
              dir="ltr"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className={`${inputBase} ${errors.nationalId ? inputInvalid : inputNormal}`}
              placeholder="9 ספרות (אופציונלי)"
            />
            {errors.nationalId && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.nationalId}</p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <LabelText>מייל</LabelText>
            <input
              name="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBase} ${errors.email ? inputInvalid : inputNormal}`}
              placeholder="כתובת מייל (אופציונלי)"
            />
            {errors.email && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.email}</p>
            )}
          </div>

          {/* General error message */}
          {!pending && !state.ok && state.message && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
            >
              {state.message}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-300/50"
          >
            {pending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                שומר…
              </>
            ) : (
              "שמור פרטים"
            )}
          </button>
        </form>
      )}
    </section>
  );
}
