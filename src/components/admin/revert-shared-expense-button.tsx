"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { revertSharedExpenseAction } from "@/app/admin/(protected)/finance/shared-expenses/actions";

export function RevertSharedExpenseButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    const ok = window.confirm(`לבטל את החיוב "${title}"? פעולה זו תמחק את כל החיובים הפרטניים.`);
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await revertSharedExpenseAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        בטל חיוב
      </button>
    </div>
  );
}
