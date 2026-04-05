"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TYPE_LABEL: Record<string, string> = {
  REGISTERED: "קבוע",
  DROP_IN: "מזדמן",
  ADMIN_OVERRIDE: "עקיפה",
};

type Entry = {
  kind: "payment" | "charge";
  id: string;
  date: Date;
  amount: number;
  runningBalance: number;
  // payment fields
  method?: string;
  description?: string | null;
  // charge fields
  chargeType?: string;
};

type Props = {
  entries: Entry[];
  totalEntries: number;
  page: number;
  totalPages: number;
  per: number;
  statementType: "all" | "payments" | "charges";
  methodLabel: Record<string, string>;
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  }).format(new Date(d));
}

function buildUrl(
  pathname: string,
  params: Record<string, string | number>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    sp.set(k, String(v));
  }
  return `${pathname}?${sp.toString()}`;
}

export function AccountStatement({
  entries,
  totalEntries,
  page,
  totalPages,
  per,
  statementType,
  methodLabel,
}: Props) {
  const pathname = usePathname();

  const typeTab = (type: string, label: string) => {
    const active = statementType === type;
    return (
      <Link
        href={buildUrl(pathname, { type, per, page: 1 })}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
          active
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">היסטוריית פעולות</h2>
        <div className="flex items-center gap-1">
          {typeTab("all", "הכל")}
          {typeTab("payments", "תשלומים")}
          {typeTab("charges", "חיובים")}
        </div>
      </div>

      {/* Per-page selector */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-50 px-5 py-2 text-xs text-zinc-500 dark:border-zinc-800/50 dark:text-zinc-400">
        <span>{totalEntries} פעולות</span>
        <div className="flex items-center gap-1">
          <span>הצג:</span>
          {([10, 20, 50] as const).map((n) => (
            <Link
              key={n}
              href={buildUrl(pathname, { type: statementType, per: n, page: 1 })}
              className={`rounded px-2 py-0.5 transition ${
                per === n
                  ? "bg-zinc-200 font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          אין פעילות פיננסית עדיין.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
          {entries.map((e) => {
            const isPayment = e.kind === "payment";
            const delta = isPayment ? e.amount : -e.amount;

            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        delta > 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                      dir="ltr"
                    >
                      {delta > 0 ? "+" : ""}₪{Math.abs(delta)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {isPayment
                        ? (methodLabel[e.method ?? ""] ?? e.method ?? "")
                        : `מפגש · ${TYPE_LABEL[e.chargeType ?? ""] ?? e.chargeType ?? ""}`}
                    </span>
                    {isPayment && e.description && (
                      <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {e.description}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDate(e.date)}
                  </span>
                </div>
                {/* Running balance */}
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    e.runningBalance > 0
                      ? "text-green-600 dark:text-green-400"
                      : e.runningBalance < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-400 dark:text-zinc-500"
                  }`}
                  dir="ltr"
                >
                  יתרה: {e.runningBalance > 0 ? "+" : ""}₪{e.runningBalance}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {page > 1 ? (
            <Link
              href={buildUrl(pathname, { type: statementType, per, page: page - 1 })}
              className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ← הקודם
            </Link>
          ) : (
            <span className="px-2 py-1 opacity-30">← הקודם</span>
          )}

          <span>
            עמוד {page} מתוך {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={buildUrl(pathname, { type: statementType, per, page: page + 1 })}
              className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              הבא →
            </Link>
          ) : (
            <span className="px-2 py-1 opacity-30">הבא →</span>
          )}
        </div>
      )}
    </section>
  );
}
