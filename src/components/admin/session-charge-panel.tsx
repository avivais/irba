"use client";

import { useState, useTransition } from "react";
import { Zap, Undo2, Pencil, Check, X, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  chargeSessionAction,
  unchargeSessionAction,
  updateSessionChargeAction,
  previewCascadeAction,
  applyCascadeAction,
} from "@/app/admin/(protected)/sessions/[id]/charge/actions";
import type { CascadeChange, CompetitionResult } from "@/app/admin/(protected)/sessions/[id]/charge/actions";

type AuditEntry = {
  changedAt: Date;
  changedBy: string;
  previousAmount: number;
  newAmount: number;
  reason: string | null;
};

type Charge = {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  calculatedAmount: number;
  chargeType: string;
  auditEntries: AuditEntry[];
};

type Props = {
  sessionId: string;
  isCharged: boolean;
  charges: Charge[];
  confirmedCount: number;
  minPlayers: number;
  canCharge: boolean;
  cannotChargeReason?: string;
};

const TYPE_LABEL: Record<string, string> = {
  REGISTERED: "קבוע",
  DROP_IN: "מזדמן",
  ADMIN_OVERRIDE: "עקיפה",
  FREE_ENTRY: "כניסה חינם",
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  }).format(new Date(d));
}

export function SessionChargePanel({
  sessionId,
  isCharged: initialCharged,
  charges: initialCharges,
  confirmedCount,
  minPlayers,
  canCharge,
  cannotChargeReason,
}: Props) {
  const [isCharged, setIsCharged] = useState(initialCharged);
  const [charges, setCharges] = useState(initialCharges);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Per-charge edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");

  // Audit history expand state (per charge)
  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(new Set());

  // Cascade state
  const [cascadePreview, setCascadePreview] = useState<CascadeChange[] | null>(null);
  const [cascadePending, setCascadePending] = useState(false);
  const [cascadeApplying, setCascadeApplying] = useState(false);
  const [cascadeMessage, setCascadeMessage] = useState<string | null>(null);
  const [competitionResult, setCompetitionResult] = useState<CompetitionResult | null>(null);
  const router = useRouter();

  function toggleAudit(chargeId: string) {
    setExpandedAudit((prev) => {
      const next = new Set(prev);
      if (next.has(chargeId)) next.delete(chargeId);
      else next.add(chargeId);
      return next;
    });
  }

  function handleCharge() {
    setError(null);
    startTransition(async () => {
      const result = await chargeSessionAction(sessionId);
      if (!result.ok) {
        setError(result.message ?? "שגיאה");
      } else {
        setIsCharged(true);
        if (result.competitionResult) {
          setCompetitionResult(result.competitionResult);
          window.location.reload();
        } else {
          window.location.reload();
        }
      }
    });
  }

  function handleUncharge() {
    if (!confirm("לבטל את חיוב המפגש? כל החיובים יימחקו.")) return;
    setError(null);
    startTransition(async () => {
      const result = await unchargeSessionAction(sessionId);
      if (!result.ok) {
        setError(result.message ?? "שגיאה");
      } else {
        setIsCharged(false);
        setCharges([]);
        window.location.reload();
      }
    });
  }

  function startEdit(charge: Charge) {
    setEditingId(charge.id);
    setEditAmount(String(charge.amount));
    setEditReason("");
    setCascadePreview(null);
    setCascadeMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAmount("");
    setEditReason("");
  }

  function handleSaveEdit(chargeId: string) {
    const newAmount = parseInt(editAmount, 10);
    if (isNaN(newAmount) || newAmount < 0) {
      setError("סכום לא תקין");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateSessionChargeAction(chargeId, sessionId, newAmount, editReason);
      if (!result.ok) {
        setError(result.message ?? "שגיאה");
        return;
      }
      setCharges((prev) =>
        prev.map((c) => (c.id === chargeId ? { ...c, amount: newAmount } : c)),
      );
      cancelEdit();

      // Automatically check for cascade impact
      setCascadePending(true);
      const preview = await previewCascadeAction(sessionId);
      setCascadePending(false);
      if (preview.ok && preview.changes.length > 0) {
        setCascadePreview(preview.changes);
      } else {
        setCascadePreview(null);
      }
    });
  }

  async function handleApplyCascade() {
    setCascadeApplying(true);
    const result = await applyCascadeAction(sessionId);
    setCascadeApplying(false);
    setCascadePreview(null);
    if (!result.ok) {
      setError(result.message ?? "שגיאה");
    } else {
      setCascadeMessage(result.message ?? "עודכן");
      window.location.reload();
    }
  }

  const totalCharged = charges.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Status + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            isCharged
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isCharged ? "bg-green-500" : "bg-zinc-400"}`} />
          {isCharged ? "חויב" : "לא חויב"}
        </span>

        {!isCharged ? (
          <button
            onClick={handleCharge}
            disabled={isPending || !canCharge}
            title={cannotChargeReason}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden />
            {isPending ? "מחייב…" : "חייב מפגש"}
          </button>
        ) : (
          <button
            onClick={handleUncharge}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {isPending ? "מבטל…" : "בטל חיוב"}
          </button>
        )}

        {!canCharge && !isCharged && cannotChargeReason && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{cannotChargeReason}</span>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Competition winner banner */}
      {competitionResult && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/20">
          <p className="text-base font-semibold text-amber-800 dark:text-amber-300">
            🏆 סיבוב {competitionResult.roundNumber} הסתיים! הזוכה: {competitionResult.winnerName}
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            נשמרה כניסה חינם עבור הזוכה.
          </p>
          <a
            href="/admin/challenges/new"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            פתח סיבוב חדש
          </a>
        </div>
      )}

      {/* Cascade banner */}
      {cascadePending && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
          בודק השפעה על מפגשים קדימה…
        </p>
      )}

      {cascadePreview && cascadePreview.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            עדכון השפיע על {cascadePreview.length} חיובים במפגשים קדימה
          </p>
          <ul className="mb-3 flex flex-col gap-1 text-xs text-amber-700 dark:text-amber-400">
            {cascadePreview.map((ch) => (
              <li key={ch.chargeId} className="flex items-center justify-between gap-2">
                <span>{ch.playerName} · {formatDate(ch.sessionDate)}</span>
                <span dir="ltr" className="tabular-nums">
                  ₪{ch.oldAmount} → ₪{ch.newAmount}
                  {ch.oldChargeType !== ch.newChargeType && (
                    <span className="mr-1 text-amber-600">
                      ({TYPE_LABEL[ch.oldChargeType] ?? ch.oldChargeType} → {TYPE_LABEL[ch.newChargeType] ?? ch.newChargeType})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={handleApplyCascade}
              disabled={cascadeApplying}
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {cascadeApplying ? "מעדכן…" : "אשר עדכון"}
            </button>
            <button
              onClick={() => setCascadePreview(null)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-400"
            >
              התעלם
            </button>
          </div>
        </div>
      )}

      {cascadeMessage && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/20 dark:text-green-400">
          {cascadeMessage}
        </p>
      )}

      {/* Charge list */}
      {isCharged && charges.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{charges.length} חיובים</span>
            <span className="tabular-nums font-semibold text-zinc-700 dark:text-zinc-200">
              סה״כ: ₪{totalCharged}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {charges.map((charge) => {
              const isEditing = editingId === charge.id;
              const hasOverride = charge.amount !== charge.calculatedAmount;
              const auditExpanded = expandedAudit.has(charge.id);
              const hasHistory = charge.auditEntries.length > 0;

              return (
                <li key={charge.id} className="py-2.5">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {charge.playerName}
                      </span>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        min={0}
                        className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="סיבה (אופציונלי)"
                        className="w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                      />
                      <button
                        onClick={() => handleSaveEdit(charge.id)}
                        disabled={isPending}
                        className="rounded-lg bg-zinc-900 p-1.5 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                        aria-label="שמור"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                        aria-label="ביטול"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {charge.playerName}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                              {TYPE_LABEL[charge.chargeType] ?? charge.chargeType}
                            </span>
                            {hasOverride && (
                              <span className="text-amber-600 dark:text-amber-400">
                                עקיפה (מחושב: ₪{charge.calculatedAmount})
                              </span>
                            )}
                            {hasHistory && (
                              <button
                                onClick={() => toggleAudit(charge.id)}
                                className="flex items-center gap-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                aria-label="הצג היסטוריה"
                              >
                                <Clock className="h-3 w-3" aria-hidden />
                                <span>{charge.auditEntries.length}</span>
                                {auditExpanded ? (
                                  <ChevronUp className="h-3 w-3" aria-hidden />
                                ) : (
                                  <ChevronDown className="h-3 w-3" aria-hidden />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`tabular-nums font-semibold ${
                              hasOverride
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                            dir="ltr"
                          >
                            ₪{charge.amount}
                          </span>
                          <button
                            onClick={() => startEdit(charge)}
                            className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            aria-label="ערוך חיוב"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>

                      {/* Audit history */}
                      {auditExpanded && hasHistory && (
                        <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                          {charge.auditEntries.map((entry, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="text-zinc-400 dark:text-zinc-500">{formatDate(entry.changedAt)}</span>
                              <span>{entry.changedBy}</span>
                              <span dir="ltr" className="tabular-nums">
                                ₪{entry.previousAmount} → ₪{entry.newAmount}
                              </span>
                              {entry.reason && (
                                <span className="italic">{entry.reason}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!isCharged && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {confirmedCount} משתתפים מאושרים · מינימום לחיוב: {minPlayers}
        </p>
      )}
    </div>
  );
}
