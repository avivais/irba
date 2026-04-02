"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, MessageCircle, RefreshCw } from "lucide-react";
import {
  fetchWaStatusAction,
  logoutWaAction,
} from "@/app/admin/(protected)/config/actions";

type Status = "loading" | "ready" | "disconnected";

export function WaBotStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    const result = await fetchWaStatusAction();
    setStatus(result.ready ? "ready" : "disconnected");
    setQr(result.qr);
  }, []);

  // Poll every 15 s while disconnected so QR refreshes as Baileys regenerates it.
  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status === "disconnected") {
      intervalRef.current = setInterval(() => void fetchStatus(), 15_000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, fetchStatus]);

  async function handleLogout() {
    setBusy(true);
    await logoutWaAction();
    await fetchStatus();
    setBusy(false);
  }

  async function handleRefresh() {
    setBusy(true);
    await fetchStatus();
    setBusy(false);
  }

  const statusLabel =
    status === "loading"
      ? "בודק…"
      : status === "ready"
        ? "מחובר"
        : "מנותק";

  const dotColor =
    status === "loading"
      ? "bg-zinc-400"
      : status === "ready"
        ? "bg-green-500"
        : "bg-red-500";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <MessageCircle className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">וואטסאפ בוט</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{statusLabel}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy}
            title="רענן"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          </button>

          {status === "ready" && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              התנתק
            </button>
          )}
        </div>
      </div>

      {/* QR code */}
      {status === "disconnected" && qr && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 py-4 dark:border-zinc-800 dark:bg-zinc-800/50">
          {/* QR is a data URL — render on white background so scanner works in dark mode */}
          <div className="rounded-lg bg-white p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Code לחיבור וואטסאפ" width={180} height={180} />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">סרוק לחיבור הבוט</p>
        </div>
      )}

      {status === "disconnected" && !qr && (
        <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
          ממתין לקוד QR…
        </p>
      )}
    </div>
  );
}
