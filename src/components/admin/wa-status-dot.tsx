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

  if (ready === null) return null;

  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-green-500" : "bg-red-500"}`}
      title={ready ? "וואטסאפ מחובר" : "וואטסאפ מנותק"}
      aria-hidden
    />
  );
}
