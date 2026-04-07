"use client";

import { useEffect, useState } from "react";
import { fetchWaStatusAction } from "@/app/admin/(protected)/wa/actions";

export function WaStatusDot() {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await fetchWaStatusAction();
      if (!cancelled) setReady(result.ready);
    }

    void refresh();
    const id = setInterval(() => { void refresh(); }, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const color =
    ready === null ? "bg-zinc-400" : ready ? "bg-green-500" : "bg-red-500";
  const label =
    ready === null ? "" : ready ? "וואטסאפ מחובר" : "וואטסאפ מנותק";

  return (
    <span
      className={`absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${color}`}
      title={label}
      aria-hidden
    />
  );
}
