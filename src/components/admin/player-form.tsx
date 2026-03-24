"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createPlayerAction,
  updatePlayerAction,
  type PlayerActionState,
} from "@/app/admin/(protected)/players/actions";
import { parsePlayerForm, POSITION_VALUES } from "@/lib/player-validation";

type PlayerData = {
  id: string;
  name: string;
  phone: string;
  playerKind: "REGISTERED" | "DROP_IN";
  positions: ("PG" | "SG" | "SF" | "PF" | "C")[];
  rank: number | null;
  balance: number;
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


export function PlayerForm(props: Props) {
  const isEdit = props.mode === "edit";
  const player = isEdit ? props.player : null;

  const action = isEdit
    ? updatePlayerAction.bind(null, player!.id)
    : createPlayerAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  const [name, setName] = useState(player?.name ?? "");
  const [phone, setPhone] = useState(player?.phone ?? "");
  const [playerKind, setPlayerKind] = useState<"REGISTERED" | "DROP_IN">(
    player?.playerKind ?? "DROP_IN",
  );
  const [positions, setPositions] = useState<string[]>(player?.positions ?? []);
  const [rank, setRank] = useState(player?.rank != null ? String(player.rank) : "");
  const [balance, setBalance] = useState(String(player?.balance ?? 0));
  const [isAdmin, setIsAdmin] = useState(player?.isAdmin ?? false);
  const [nickname, setNickname] = useState(player?.nickname ?? "");
  const [firstNameHe, setFirstNameHe] = useState(player?.firstNameHe ?? "");
  const [lastNameHe, setLastNameHe] = useState(player?.lastNameHe ?? "");
  const [firstNameEn, setFirstNameEn] = useState(player?.firstNameEn ?? "");
  const [lastNameEn, setLastNameEn] = useState(player?.lastNameEn ?? "");
  const [birthdate, setBirthdate] = useState(
    player?.birthdate ? new Date(player.birthdate).toISOString().slice(0, 10) : "",
  );

  const [nameBlurred, setNameBlurred] = useState(false);
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const [suppressServerError, setSuppressServerError] = useState(false);

  const validation = parsePlayerForm({
    name,
    phone: isEdit ? (player?.phone ?? "") : phone,
    playerKind,
    positions,
    rank: rank || undefined,
    balance: balance || undefined,
    isAdmin: isAdmin ? "on" : undefined,
    nickname: nickname || undefined,
    firstNameHe: firstNameHe || undefined,
    lastNameHe: lastNameHe || undefined,
    firstNameEn: firstNameEn || undefined,
    lastNameEn: lastNameEn || undefined,
    birthdate: birthdate || undefined,
  });

  const fieldErrors = validation.ok ? {} : validation.errors;
  const nameError = fieldErrors.name;
  const phoneError = fieldErrors.phone;
  const rankError = fieldErrors.rank;
  const balanceError = fieldErrors.balance;
  const nameErrorVisible = nameBlurred && Boolean(nameError);
  const phoneErrorVisible = !isEdit && phoneBlurred && Boolean(phoneError);

  const formValid = validation.ok;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validation.ok) {
      e.preventDefault();
      setNameBlurred(true);
      setPhoneBlurred(true);
      return;
    }
    setSuppressServerError(false);
  }

  function onFieldChange(setter: (v: string) => void, value: string) {
    setter(value);
    setSuppressServerError(true);
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
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="player-name"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          שם מלא
        </label>
        <input
          id="player-name"
          name="name"
          type="text"
          autoComplete="off"
          maxLength={80}
          value={name}
          onChange={(e) => onFieldChange(setName, e.target.value)}
          onBlur={() => setNameBlurred(true)}
          aria-invalid={nameErrorVisible}
          aria-describedby={nameErrorVisible ? "player-name-error" : undefined}
          className={`${inputBase} ${nameErrorVisible ? inputInvalid : inputNormal}`}
          placeholder="שם השחקן"
        />
        {nameErrorVisible && (
          <p id="player-name-error" className="text-xs text-red-600 dark:text-red-400">
            {nameError}
          </p>
        )}
      </div>

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
            {/* Pass phone value through formData even though action ignores it */}
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

      {/* Balance */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="player-balance"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          יתרה
          <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
            (ניתן להיות שלילי)
          </span>
        </label>
        <input
          id="player-balance"
          name="balance"
          type="number"
          step={1}
          value={balance}
          onChange={(e) => onFieldChange(setBalance, e.target.value)}
          aria-invalid={Boolean(balanceError)}
          className={`${inputBase} ${balanceError ? inputInvalid : inputNormal}`}
          placeholder="0"
        />
        {balanceError && (
          <p className="text-xs text-red-600 dark:text-red-400">{balanceError}</p>
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
        <label htmlFor="player-birthdate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          תאריך לידה
          <span className="mr-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">(אופציונלי)</span>
        </label>
        <input
          id="player-birthdate"
          name="birthdate"
          type="date"
          value={birthdate}
          onChange={(e) => onFieldChange(setBirthdate, e.target.value)}
          className={`${inputBase} ${inputNormal}`}
        />
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
          "צור שחקן"
        )}
      </button>
    </form>
  );
}
