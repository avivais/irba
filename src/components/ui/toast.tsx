"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type ToastState = { message: string; ok: boolean } | null;

const DURATION = 4000;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, ok: boolean) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, ok });
      timerRef.current = setTimeout(dismiss, DURATION);
    },
    [dismiss],
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { showToast, dismiss, toast };
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      role={toast.ok ? "status" : "alert"}
      className={`fixed bottom-5 left-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl transition-all duration-200 ${
        toast.ok
          ? "bg-green-800 text-green-50 dark:bg-green-700"
          : "bg-red-800 text-red-50 dark:bg-red-700"
      }`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="סגור"
        className="opacity-60 transition hover:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
