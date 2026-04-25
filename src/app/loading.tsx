import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center px-4 py-16"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">טוען…</span>
      </div>
    </div>
  );
}
