"use client";

import { useActionState, useRef, useState } from "react";
import { Calendar, Loader2, UserRoundPen } from "lucide-react";
import {
  completeProfileDetailsAction,
  type ProfileActionState,
} from "@/app/actions/player-profile";

type Props = {
  initial: {
    nickname: string | null;
    firstNameHe: string | null;
    lastNameHe: string | null;
    firstNameEn: string | null;
    lastNameEn: string | null;
    birthdate: Date | null;
    email: string | null;
    nationalId: string | null;
  };
};

const initialState: ProfileActionState = { ok: false };

const inputBase =
  "rounded-lg border bg-zinc-900 px-3 py-2.5 text-base text-zinc-100 shadow-sm focus:outline-none focus:ring-2";
const inputNormal =
  "border-zinc-700 focus:border-zinc-500 focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-500 focus:ring-red-500/35";

function formatIsraeliDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${parseInt(day)}.${parseInt(month)}.${year}`;
}

function parseIsraeliDate(text: string): string | null {
  const m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium text-zinc-300">{children}</span>
  );
}

export function ProfileCompletionOverlay({ initial }: Props) {
  const [state, formAction, pending] = useActionState(
    completeProfileDetailsAction,
    initialState,
  );

  const [nickname, setNickname] = useState(initial.nickname ?? "");
  const [firstNameHe, setFirstNameHe] = useState(initial.firstNameHe ?? "");
  const [lastNameHe, setLastNameHe] = useState(initial.lastNameHe ?? "");
  const [firstNameEn, setFirstNameEn] = useState(initial.firstNameEn ?? "");
  const [lastNameEn, setLastNameEn] = useState(initial.lastNameEn ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [nationalId, setNationalId] = useState(initial.nationalId ?? "");

  const initialIso = initial.birthdate
    ? new Date(initial.birthdate).toISOString().slice(0, 10)
    : "";
  const [birthdate, setBirthdate] = useState(initialIso);
  const [birthdateDisplay, setBirthdateDisplay] = useState(
    initialIso ? formatIsraeliDate(initialIso) : "",
  );
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const errors = state.errors ?? {};

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="השלמת פרטים אישיים"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/98 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-5 py-4">
        <div className="flex items-center gap-2">
          <UserRoundPen className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-bold text-zinc-100">השלמת פרטים אישיים</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          כדי להמשיך, נא למלא את הפרטים הבאים.
        </p>
      </div>

      {/* Scrollable form */}
      <form
        action={formAction}
        className="flex flex-1 flex-col overflow-hidden"
        noValidate
      >
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-4">
            {/* Hebrew names */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <FieldLabel>שם פרטי (עברית)*</FieldLabel>
                <input
                  name="firstNameHe"
                  type="text"
                  maxLength={80}
                  value={firstNameHe}
                  onChange={(e) => setFirstNameHe(e.target.value)}
                  className={`${inputBase} ${errors.firstNameHe ? inputInvalid : inputNormal}`}
                  placeholder="שם פרטי"
                />
                {errors.firstNameHe && (
                  <p className="text-xs text-red-400">{errors.firstNameHe}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <FieldLabel>שם משפחה (עברית)*</FieldLabel>
                <input
                  name="lastNameHe"
                  type="text"
                  maxLength={80}
                  value={lastNameHe}
                  onChange={(e) => setLastNameHe(e.target.value)}
                  className={`${inputBase} ${errors.lastNameHe ? inputInvalid : inputNormal}`}
                  placeholder="שם משפחה"
                />
                {errors.lastNameHe && (
                  <p className="text-xs text-red-400">{errors.lastNameHe}</p>
                )}
              </div>
            </div>

            {/* Birthdate */}
            <div className="flex flex-col gap-1">
              <FieldLabel>תאריך לידה*</FieldLabel>
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
                  className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 shadow-sm transition hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/30"
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
                <p className="text-xs text-red-400">{errors.birthdate}</p>
              )}
            </div>

            {/* National ID */}
            <div className="flex flex-col gap-1">
              <FieldLabel>תעודת זהות*</FieldLabel>
              <input
                name="nationalId"
                type="text"
                inputMode="numeric"
                maxLength={11}
                dir="ltr"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className={`${inputBase} ${errors.nationalId ? inputInvalid : inputNormal}`}
                placeholder="9 ספרות"
              />
              {errors.nationalId && (
                <p className="text-xs text-red-400">{errors.nationalId}</p>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1">
              <FieldLabel>מייל*</FieldLabel>
              <input
                name="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputBase} ${errors.email ? inputInvalid : inputNormal}`}
                placeholder="כתובת מייל"
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email}</p>
              )}
            </div>

            {/* English names — optional */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <FieldLabel>First name (English)</FieldLabel>
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
                <FieldLabel>Last name (English)</FieldLabel>
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

            {/* Nickname — optional */}
            <div className="flex flex-col gap-1">
              <FieldLabel>כינוי</FieldLabel>
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
                <p className="text-xs text-red-400">{errors.nickname}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 py-4">
          {!pending && !state.ok && state.message && (
            <p className="mb-3 text-center text-sm text-red-400">{state.message}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-600/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "שמור והמשך"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
