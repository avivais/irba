"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  addPaymentAction,
  deletePaymentAction,
} from "@/app/admin/(protected)/players/[id]/payments/actions";
import type { PaymentActionState } from "@/app/admin/(protected)/players/[id]/payments/actions";
import { DateInputIL } from "@/components/ui/date-input-il";

type LedgerRow = {
  id: string;
  kind: "PAYMENT" | "SESSION_CHARGE" | "SHARED_EXPENSE_CHARGE";
  date: Date;
  amount: number;
  balanceAfter: number;
  method?: string;
  description?: string | null;
  sessionId?: string;
  chargeType?: string;
  calculatedAmount?: number;
  sharedExpenseTitle?: string;
};

type BalanceBreakdown = {
  totalPaid: number;
  totalCharged: number;
  balance: number;
};

type Props = {
  playerId: string;
  ledgerRows: LedgerRow[];
  balance: BalanceBreakdown;
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "מזומן",
  PAYBOX: "Paybox",
  BIT: "Bit",
  BANK_TRANSFER: "העברה",
  OTHER: "אחר",
};

const CHARGE_TYPE_LABEL: Record<string, string> = {
  REGISTERED: "קבוע",
  DROP_IN: "מזדמן",
  ADMIN_OVERRIDE: "עקיפה",
  FREE_ENTRY: "כניסה חינם",
};

const LEDGER_PAGE_SIZE = 10;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

function formatSignedAmount(n: number): string {
  if (n === 0) return "₪0";
  return n > 0 ? `+₪${n}` : `-₪${Math.abs(n)}`;
}

const INIT: PaymentActionState = { ok: false };

const inputBase =
  "block w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 dark:text-zinc-100 dark:placeholder-zinc-500";
const inputNormal =
  "border-zinc-300 bg-white focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-800";

export function PlayerBalance({ playerId, ledgerRows, balance }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibleRowCount, setVisibleRowCount] = useState(LEDGER_PAGE_SIZE);

  const boundAdd = addPaymentAction.bind(null, playerId);
  const [addState, addAction, addPending] = useActionState(boundAdd, INIT);

  async function handleDelete(paymentId: string) {
    if (!confirm("למחוק את התשלום?")) return;
    setDeletingId(paymentId);
    await deletePaymentAction(playerId, paymentId);
    setDeletingId(null);
  }

  const balanceColor =
    balance.balance > 0
      ? "text-green-700 dark:text-green-400"
      : balance.balance < 0
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-600 dark:text-zinc-400";

  const visibleLedgerRows = ledgerRows.slice(0, visibleRowCount);
  const hasMoreRows = visibleRowCount < ledgerRows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-800/50">
        <span className="text-zinc-500 dark:text-zinc-400">
          שולם:{" "}
          <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200" dir="ltr">
            ₪{balance.totalPaid}
          </span>
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          חויב:{" "}
          <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200" dir="ltr">
            ₪{balance.totalCharged}
          </span>
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          יתרה:{" "}
          <span className={`font-bold tabular-nums ${balanceColor}`} dir="ltr">
            {formatSignedAmount(balance.balance)}
          </span>
        </span>
      </div>
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 self-start rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          הוסף תשלום
        </button>
      ) : (
        <form
          action={addAction}
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                תאריך
              </label>
              <DateInputIL
                name="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                ariaLabel="תאריך"
                className={`${inputBase} ${inputNormal}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                סכום (₪)
              </label>
              <input
                type="number"
                name="amount"
                required
                placeholder="100"
                className={`${inputBase} ${inputNormal}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                אמצעי תשלום
              </label>
              <select
                name="method"
                defaultValue="BIT"
                className={`${inputBase} ${inputNormal}`}
              >
                {Object.entries(METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                הערה (אופציונלי)
              </label>
              <input
                type="text"
                name="description"
                maxLength={200}
                placeholder="פירוט"
                className={`${inputBase} ${inputNormal}`}
              />
            </div>
          </div>

          {addState.message && !addState.ok && (
            <p className="text-sm text-red-600 dark:text-red-400">{addState.message}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={addPending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {addPending ? "שומר…" : "שמור"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {ledgerRows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          אין חיובים או תשלומים עדיין.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {visibleLedgerRows.map((row) => {
            const signedAmount = row.kind === "PAYMENT" ? row.amount : -row.amount;
            const isPayment = row.kind === "PAYMENT";
            const hasOverride =
              row.kind === "SESSION_CHARGE" &&
              row.calculatedAmount !== undefined &&
              row.amount !== row.calculatedAmount;

            return (
              <li
                key={`${row.kind}:${row.id}`}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  {row.kind === "SESSION_CHARGE" && row.sessionId ? (
                    <Link
                      href={`/admin/sessions/${row.sessionId}`}
                      className="text-sm font-medium text-zinc-800 hover:underline dark:text-zinc-200"
                    >
                      {formatDate(row.date)}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {formatDate(row.date)}
                    </span>
                  )}

                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium ${
                        isPayment
                          ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      }`}
                    >
                      {row.kind === "PAYMENT"
                        ? "תשלום"
                        : row.kind === "SESSION_CHARGE"
                          ? "חיוב מפגש"
                          : "הוצאה משותפת"}
                    </span>
                    {row.kind === "PAYMENT" && row.method && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                        {METHOD_LABEL[row.method] ?? row.method}
                      </span>
                    )}
                    {row.kind === "SESSION_CHARGE" && row.chargeType && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                        {CHARGE_TYPE_LABEL[row.chargeType] ?? row.chargeType}
                      </span>
                    )}
                    {row.kind === "SHARED_EXPENSE_CHARGE" && row.sharedExpenseTitle && (
                      <span className="truncate">{row.sharedExpenseTitle}</span>
                    )}
                    {row.description && (
                      <span className="max-w-full truncate">{row.description}</span>
                    )}
                    {hasOverride && (
                      <span className="text-amber-600 dark:text-amber-400">
                        עקיפה (מחושב: ₪{row.calculatedAmount})
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    יתרה לאחר הפעולה:{" "}
                    <span
                      dir="ltr"
                      className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300"
                    >
                      {formatSignedAmount(row.balanceAfter)}
                    </span>
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    dir="ltr"
                    className={`tabular-nums font-semibold ${
                      signedAmount >= 0
                        ? "text-green-700 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatSignedAmount(signedAmount)}
                  </span>
                  {isPayment && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400/40 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-red-700 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                      aria-label="מחק תשלום"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMoreRows && (
        <button
          type="button"
          onClick={() =>
            setVisibleRowCount((count) => count + LEDGER_PAGE_SIZE)
          }
          className="self-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          טען עוד…
        </button>
      )}
    </div>
  );
}
