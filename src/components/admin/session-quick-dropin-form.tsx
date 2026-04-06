"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  quickAddDropInAction,
  lookupPlayerByPhoneAction,
  type SessionAttendanceState,
  type PhoneLookupResult,
} from "@/app/admin/(protected)/sessions/[id]/actions";

const ISRAELI_MOBILE = /^05\d{8}$/;

const initialState: SessionAttendanceState = { ok: false };

export function SessionQuickDropInForm({ sessionId }: { sessionId: string }) {
  const boundAction = quickAddDropInAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [nameBlurred, setNameBlurred] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const [lookup, setLookup] = useState<PhoneLookupResult | null>(null);
  // Track which phone value the current lookup result belongs to
  const [resolvedPhone, setResolvedPhone] = useState("");
  const [, startLookup] = useTransition();

  const isPhoneValid = ISRAELI_MOBILE.test(phone);
  const lookupSettled = !isPhoneValid || resolvedPhone === phone;
  const isExistingPlayer = lookupSettled && lookup?.status === "existing_not_registered";
  const isAlreadyRegistered = lookupSettled && lookup?.status === "already_registered";
  const isNameValid = isExistingPlayer || name.trim().length > 0;
  const isValid = isPhoneValid && isNameValid && !isAlreadyRegistered && lookupSettled;
  const showNameError = nameBlurred && !isExistingPlayer && name.trim().length === 0;
  const showPhoneError = phoneBlurred && phone.length > 0 && !isPhoneValid;

  // Lookup when phone becomes valid
  useEffect(() => {
    if (!isPhoneValid) {
      setLookup(null);
      setResolvedPhone("");
      return;
    }
    startLookup(async () => {
      const result = await lookupPlayerByPhoneAction(sessionId, phone);
      setLookup(result);
      setResolvedPhone(phone);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, sessionId]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setName("");
      setNameBlurred(false);
      setPhone("");
      setPhoneBlurred(false);
      setLookup(null);
    }
  }, [state]);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(e.target.value.replace(/\D/g, ""));
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        הוסף מזדמן חדש
      </p>
      <div className="flex flex-wrap gap-2">
        {!isExistingPlayer && (
          <input
            name="name"
            type="text"
            required
            aria-label="שם"
            placeholder="שם"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameBlurred(true)}
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 dark:text-zinc-100 ${
              showNameError
                ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500 dark:bg-red-950/20"
                : "border-zinc-300 bg-white focus:border-zinc-500 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-800"
            }`}
          />
        )}
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          aria-label="מספר טלפון"
          placeholder="05XXXXXXXX"
          dir="ltr"
          value={phone}
          onChange={handlePhoneChange}
          onBlur={() => setPhoneBlurred(true)}
          className={`min-w-0 w-36 rounded-lg border px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 dark:text-zinc-100 ${
            showPhoneError
              ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500 dark:bg-red-950/20"
              : "border-zinc-300 bg-white focus:border-zinc-500 focus:ring-zinc-500/30 dark:border-zinc-600 dark:bg-zinc-800"
          }`}
        />
        <button
          type="submit"
          disabled={pending || !isValid}
          aria-label="הוסף מזדמן"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {showNameError && (
        <p className="text-xs text-red-600 dark:text-red-400">נא להזין שם</p>
      )}
      {showPhoneError && (
        <p className="text-xs text-red-600 dark:text-red-400">
          מספר טלפון לא תקין — נדרש פורמט 05XXXXXXXX
        </p>
      )}

      {lookupSettled && (isExistingPlayer || isAlreadyRegistered) && lookup && "displayName" in lookup && (
        <p
          className={`text-xs ${
            isAlreadyRegistered
              ? "text-red-600 dark:text-red-400"
              : "text-blue-600 dark:text-blue-400"
          }`}
        >
          {isAlreadyRegistered
            ? `${lookup.displayName} כבר רשום למפגש זה`
            : `שחקן קיים: ${lookup.displayName}`}
        </p>
      )}

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-xs ${state.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
