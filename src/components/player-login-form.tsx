"use client";

import { useState, useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  requestOtpAction,
  verifyOtpAction,
  playerPasswordLoginAction,
  completeProfileAction,
  requestPasswordResetAction,
  confirmPasswordResetAction,
  setNameAction,
  type PlayerAuthState,
} from "@/app/actions/player-auth";

type Mode =
  | "phone_entry"
  | "otp_sent"
  | "set_profile"
  | "set_name"
  | "reset_phone"
  | "reset_otp"
  | "reset_pw";

const initialState: PlayerAuthState = { ok: false };

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";
const inputInvalid =
  "border-red-500 focus:border-red-600 focus:ring-red-600/35 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/35";
const btnPrimary =
  "flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-zinc-300/50";
const btnSecondary =
  "flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-400/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
const card =
  "flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900";

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
    >
      {children}
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
    >
      {message}
    </p>
  );
}

function DevOtpBanner({ otp }: { otp: string }) {
  return (
    <p
      role="note"
      className="rounded-md bg-yellow-50 px-3 py-2 text-sm font-mono text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200"
    >
      קוד לפיתוח: <strong>{otp}</strong>
    </p>
  );
}

function SpinnerLabel({
  pending,
  label,
  loadingLabel,
}: {
  pending: boolean;
  label: string;
  loadingLabel: string;
}) {
  return pending ? (
    <>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {loadingLabel}
    </>
  ) : (
    <>{label}</>
  );
}

export function PlayerLoginForm({ redirectTo }: { redirectTo?: string } = {}) {
  const [mode, setMode] = useState<Mode>("phone_entry");
  const [phone, setPhone] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // OTP request
  const [otpReqState, otpReqAction, otpReqPending] = useActionState(
    async (prev: PlayerAuthState, fd: FormData) => {
      const result = await requestOtpAction(prev, fd);
      if (result.ok && result.step === "otp_sent") {
        setMode("otp_sent");
        if (result.devOtp) setDevOtp(result.devOtp);
      }
      return result;
    },
    initialState,
  );

  // OTP verify
  const [otpVerifyState, otpVerifyAction, otpVerifyPending] = useActionState(
    async (prev: PlayerAuthState, fd: FormData) => {
      const result = await verifyOtpAction(prev, fd);
      if (result.ok && result.step === "set_profile") setMode("set_profile");
      if (result.ok && result.step === "set_name") setMode("set_name");
      return result;
    },
    initialState,
  );

  // Password login
  const [pwLoginState, pwLoginAction, pwLoginPending] = useActionState(
    async (prev: PlayerAuthState, fd: FormData) => {
      const result = await playerPasswordLoginAction(prev, fd);
      if (result.ok && result.step === "otp_sent") {
        setMode("otp_sent");
        if (result.devOtp) setDevOtp(result.devOtp);
      }
      return result;
    },
    initialState,
  );

  // Complete profile
  const [profileState, profileAction, profilePending] = useActionState(
    completeProfileAction,
    initialState,
  );

  // Set name (drop-in onboarding)
  const [nameState, nameAction, namePending] = useActionState(
    setNameAction,
    initialState,
  );

  // Reset: request OTP
  const [resetReqState, resetReqAction, resetReqPending] = useActionState(
    async (prev: PlayerAuthState, fd: FormData) => {
      const result = await requestPasswordResetAction(prev, fd);
      if (result.ok && result.step === "otp_sent") {
        setMode("reset_otp");
        if (result.devOtp) setDevOtp(result.devOtp);
      }
      return result;
    },
    initialState,
  );

  // Reset: confirm OTP + new password
  const [resetConfirmState, resetConfirmAction, resetConfirmPending] =
    useActionState(confirmPasswordResetAction, initialState);

  // ── Render modes ────────────────────────────────────────────────────────────

  if (mode === "phone_entry") {
    const errorMsg = usePassword
      ? (!pwLoginPending && !pwLoginState.ok && pwLoginState.message
          ? pwLoginState.message
          : null)
      : (!otpReqPending && !otpReqState.ok && otpReqState.message
          ? otpReqState.message
          : null);

    return (
      <div className={card}>
        {!usePassword ? (
          <form action={otpReqAction} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="phone-otp">מספר טלפון</FieldLabel>
              <input
                id="phone-otp"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="05X-XXXXXXX"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(errorMsg)}
                className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                name="rememberMe"
                className="rounded"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              זכור אותי
            </label>
            {errorMsg && <ErrorBanner message={errorMsg} />}
            <button type="submit" disabled={otpReqPending} className={btnPrimary}>
              <SpinnerLabel
                pending={otpReqPending}
                label="שלח קוד אימות"
                loadingLabel="שולח…"
              />
            </button>
            <button
              type="button"
              onClick={() => setUsePassword(true)}
              className={btnSecondary}
            >
              כניסה עם סיסמה
            </button>
          </form>
        ) : (
          <form action={pwLoginAction} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="phone-pw">מספר טלפון</FieldLabel>
              <input
                id="phone-pw"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="05X-XXXXXXX"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(errorMsg)}
                className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="password">סיסמה</FieldLabel>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={512}
                aria-invalid={Boolean(errorMsg)}
                className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                name="rememberMe"
                className="rounded"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              זכור אותי
            </label>
            {errorMsg && <ErrorBanner message={errorMsg} />}
            <button type="submit" disabled={pwLoginPending} className={btnPrimary}>
              <SpinnerLabel
                pending={pwLoginPending}
                label="כניסה"
                loadingLabel="מתחבר…"
              />
            </button>
            <button
              type="button"
              onClick={() => setUsePassword(false)}
              className={btnSecondary}
            >
              כניסה עם קוד אימות
            </button>
          </form>
        )}

        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => setMode("reset_phone")}
            className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            שכחתי סיסמה
          </button>
        </div>
      </div>
    );
  }

  if (mode === "otp_sent") {
    const errorMsg =
      !otpVerifyPending && !otpVerifyState.ok && otpVerifyState.message
        ? otpVerifyState.message
        : null;

    return (
      <form action={otpVerifyAction} className={`${card} gap-4`} noValidate>
        <input type="hidden" name="phone" value={phone} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          קוד אימות נשלח לוואטסאפ של <strong dir="ltr">{phone}</strong>. הזן
          אותו כאן:
        </p>
        {devOtp && <DevOtpBanner otp={devOtp} />}
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="otp">קוד אימות (6 ספרות)</FieldLabel>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            dir="ltr"
            aria-invalid={Boolean(errorMsg)}
            className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
          />
        </div>
        <input type="hidden" name="rememberMe" value={rememberMe ? "on" : ""} />
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
        {errorMsg && <ErrorBanner message={errorMsg} />}
        <button
          type="submit"
          disabled={otpVerifyPending}
          className={btnPrimary}
        >
          <SpinnerLabel
            pending={otpVerifyPending}
            label="אמת קוד"
            loadingLabel="מאמת…"
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("phone_entry");
            setDevOtp(null);
          }}
          className="text-center text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400"
        >
          חזרה
        </button>
      </form>
    );
  }

  if (mode === "set_profile") {
    const errorMsg =
      !profilePending && !profileState.ok && profileState.message
        ? profileState.message
        : null;

    return (
      <form action={profileAction} className={`${card} gap-4`} noValidate>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          ברוך הבא! הגדר סיסמה לכניסות הבאות.
        </p>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="new-password">סיסמה חדשה</FieldLabel>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={512}
            aria-invalid={Boolean(errorMsg)}
            className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="confirm-password">אמת סיסמה</FieldLabel>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={512}
            aria-invalid={Boolean(errorMsg)}
            className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
          />
        </div>
        {errorMsg && <ErrorBanner message={errorMsg} />}
        <button
          type="submit"
          disabled={profilePending}
          className={btnPrimary}
        >
          <SpinnerLabel
            pending={profilePending}
            label="שמור והמשך"
            loadingLabel="שומר…"
          />
        </button>
      </form>
    );
  }

  if (mode === "set_name") {
    const nameError =
      !namePending && !nameState.ok && nameState.message
        ? nameState.message
        : null;

    return (
      <form action={nameAction} className={`${card} gap-4`} noValidate>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ברוך הבא! איך לקרוא לך? (אופציונלי)
        </p>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="player-name">שם</FieldLabel>
          <input
            id="player-name"
            name="name"
            type="text"
            autoComplete="given-name"
            maxLength={80}
            placeholder="השם שלך"
            className={`${inputBase} ${inputNormal}`}
          />
        </div>
        {nameError && <ErrorBanner message={nameError} />}
        <button type="submit" disabled={namePending} className={btnPrimary}>
          <SpinnerLabel
            pending={namePending}
            label="שמור והמשך"
            loadingLabel="שומר…"
          />
        </button>
        <button
          type="submit"
          name="name"
          value=""
          disabled={namePending}
          className={btnSecondary}
        >
          דלג — הירשם ללא שם
        </button>
      </form>
    );
  }

  if (mode === "reset_phone") {
    const errorMsg =
      !resetReqPending && !resetReqState.ok && resetReqState.message
        ? resetReqState.message
        : null;

    return (
      <form action={resetReqAction} className={`${card} gap-4`} noValidate>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          הזן את מספר הטלפון שלך ונשלח קוד לאיפוס סיסמה.
        </p>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="reset-phone">מספר טלפון</FieldLabel>
          <input
            id="reset-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="05X-XXXXXXX"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(errorMsg)}
            className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
          />
        </div>
        {errorMsg && <ErrorBanner message={errorMsg} />}
        <button
          type="submit"
          disabled={resetReqPending}
          className={btnPrimary}
        >
          <SpinnerLabel
            pending={resetReqPending}
            label="שלח קוד לאיפוס"
            loadingLabel="שולח…"
          />
        </button>
        <button
          type="button"
          onClick={() => setMode("phone_entry")}
          className="text-center text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400"
        >
          חזרה לכניסה
        </button>
      </form>
    );
  }

  if (mode === "reset_otp") {
    const errorMsg =
      !resetConfirmPending && !resetConfirmState.ok && resetConfirmState.message
        ? resetConfirmState.message
        : null;

    return (
      <form action={resetConfirmAction} className={`${card} gap-4`} noValidate>
        <input type="hidden" name="phone" value={phone} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          הזן את הקוד שנשלח לוואטסאפ שלך ואת הסיסמה החדשה.
        </p>
        {devOtp && <DevOtpBanner otp={devOtp} />}
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="reset-otp">קוד אימות (6 ספרות)</FieldLabel>
          <input
            id="reset-otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            dir="ltr"
            aria-invalid={Boolean(errorMsg)}
            className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="new-pw">סיסמה חדשה</FieldLabel>
          <input
            id="new-pw"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={512}
            aria-invalid={Boolean(errorMsg)}
            className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="confirm-pw">אמת סיסמה</FieldLabel>
          <input
            id="confirm-pw"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={512}
            aria-invalid={Boolean(errorMsg)}
            className={`${inputBase} ${errorMsg ? inputInvalid : inputNormal}`}
          />
        </div>
        {errorMsg && <ErrorBanner message={errorMsg} />}
        <button
          type="submit"
          disabled={resetConfirmPending}
          className={btnPrimary}
        >
          <SpinnerLabel
            pending={resetConfirmPending}
            label="אפס סיסמה"
            loadingLabel="מאפס…"
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("reset_phone");
            setDevOtp(null);
          }}
          className="text-center text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400"
        >
          חזרה
        </button>
      </form>
    );
  }

  return null;
}
