"use client";

import { useState } from "react";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });

  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.floor(months / 12), "year");
}

function formatLocal(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CommitInfo({
  hash,
  utcDate,
}: {
  hash: string;
  utcDate: string;
}) {
  // Lazy initializer runs once on the client — avoids setState-in-effect lint error.
  // utcDate is a build-time constant so it never changes after mount.
  const [display] = useState<{ local: string; ago: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const d = new Date(utcDate);
    return { local: formatLocal(d), ago: timeAgo(d) };
  });

  return (
    <span>
      {hash}
      {display ? (
        <>
          <span> · {display.local}</span>
          <span className="block text-zinc-400 dark:text-zinc-600">{display.ago}</span>
        </>
      ) : (
        <span> · {utcDate}</span>
      )}
    </span>
  );
}
