"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import {
  loadInitialPreviewAction,
  createSharedExpenseAction,
} from "@/app/admin/(protected)/finance/shared-expenses/actions";
import {
  computeSharedExpenseShares,
  type EligibilityPool,
  type EligiblePlayer,
  type RosterPlayer,
} from "@/lib/shared-expenses";

type Row = {
  playerId: string;
  name: string;
  playerKind: "REGISTERED" | "DROP_IN";
  currentBalance: number;
  /** Null when manually added (criteria not relevant). */
  attendancePct: number | null;
  sessionsAttended: number | null;
  sessionsTotal: number | null;
  manuallyAdded: boolean;
};

const inputBase =
  "rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputNormal =
  "border-zinc-300 focus:border-zinc-600 focus:ring-zinc-600/30 dark:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30";

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function SharedExpenseForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [lookbackYears, setLookbackYears] = useState("2");
  const [minAttendancePct, setMinAttendancePct] = useState("50");
  const [eligibilityPool, setEligibilityPool] =
    useState<EligibilityPool>("REGISTERED_ONLY");

  const [rows, setRows] = useState<Row[] | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addPlayerSelection, setAddPlayerSelection] = useState("");
  const [addPlayerSearch, setAddPlayerSearch] = useState("");

  const [previewing, startPreview] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const totalAmountNum = Math.floor(Number(totalAmount));
  const lookbackYearsNum = Number(lookbackYears);
  const minAttendancePctNum = Number(minAttendancePct) / 100;

  const split = useMemo(() => {
    if (!rows || rows.length === 0 || !Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
      return null;
    }
    return computeSharedExpenseShares(totalAmountNum, rows.length);
  }, [rows, totalAmountNum]);

  const rosterById = useMemo(() => {
    const m = new Map<string, RosterPlayer>();
    for (const r of roster) m.set(r.playerId, r);
    return m;
  }, [roster]);

  const availableForAdd = useMemo(() => {
    if (!rows) return [];
    const taken = new Set(rows.map((r) => r.playerId));
    const filter = addPlayerSearch.trim().toLowerCase();
    return roster
      .filter((p) => !taken.has(p.playerId))
      .filter((p) => !filter || p.name.toLowerCase().includes(filter));
  }, [rows, roster, addPlayerSearch]);

  const autoCount = rows?.filter((r) => !r.manuallyAdded).length ?? 0;
  const manualCount = rows?.filter((r) => r.manuallyAdded).length ?? 0;

  function loadPreview() {
    setPreviewError(null);
    setSubmitError(null);

    if (!Number.isInteger(totalAmountNum) || totalAmountNum <= 0) {
      setPreviewError("יש להזין סכום שלם וחיובי לפני יצירת התצוגה.");
      return;
    }
    if (!Number.isFinite(lookbackYearsNum) || lookbackYearsNum <= 0) {
      setPreviewError("תקופת הסתכלות חייבת להיות גדולה מאפס.");
      return;
    }
    if (
      !Number.isFinite(minAttendancePctNum) ||
      minAttendancePctNum < 0 ||
      minAttendancePctNum > 1
    ) {
      setPreviewError("אחוז ההשתתפות חייב להיות בין 0 ל-100.");
      return;
    }

    startPreview(async () => {
      const result = await loadInitialPreviewAction({
        totalAmount: totalAmountNum,
        lookbackYears: lookbackYearsNum,
        minAttendancePct: minAttendancePctNum,
        eligibilityPool,
      });
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setRoster(result.roster);
      setRows(
        result.eligible.map((p: EligiblePlayer) => ({
          playerId: p.playerId,
          name: p.name,
          playerKind: p.playerKind,
          currentBalance: p.currentBalance,
          attendancePct: p.attendancePct,
          sessionsAttended: p.sessionsAttended,
          sessionsTotal: p.sessionsTotal,
          manuallyAdded: false,
        })),
      );
    });
  }

  function removeRow(playerId: string) {
    setRows((prev) => prev?.filter((r) => r.playerId !== playerId) ?? prev);
  }

  function addRow(playerId: string) {
    if (!playerId) return;
    const player = rosterById.get(playerId);
    if (!player) return;
    setRows((prev) => {
      if (!prev) return prev;
      if (prev.some((r) => r.playerId === playerId)) return prev;
      return [
        ...prev,
        {
          playerId: player.playerId,
          name: player.name,
          playerKind: player.playerKind,
          currentBalance: player.currentBalance,
          attendancePct: null,
          sessionsAttended: null,
          sessionsTotal: null,
          manuallyAdded: true,
        },
      ];
    });
    setAddPlayerSelection("");
    setAddPlayerSearch("");
  }

  function submit() {
    if (!rows || rows.length === 0) return;

    const includedPlayerIds = rows.filter((r) => !r.manuallyAdded).map((r) => r.playerId);
    const manuallyAddedPlayerIds = rows
      .filter((r) => r.manuallyAdded)
      .map((r) => r.playerId);

    const playerWord = rows.length === 1 ? "שחקן אחד" : `${rows.length} שחקנים`;
    const breakdown =
      manualCount > 0
        ? ` (${autoCount} אוטומטיים, ${manualCount} ידניים)`
        : "";
    const ok = window.confirm(
      `לחייב ${playerWord}${breakdown} בסך ₪${totalAmountNum} (${split?.share}-${
        (split?.share ?? 0) + (split?.remainder ? 1 : 0)
      } ₪לשחקן)?`,
    );
    if (!ok) return;

    setSubmitError(null);
    startSubmit(async () => {
      const result = await createSharedExpenseAction({
        title: title.trim(),
        description: description.trim() || null,
        totalAmount: totalAmountNum,
        lookbackYears: lookbackYearsNum,
        minAttendancePct: minAttendancePctNum,
        eligibilityPool,
        includedPlayerIds,
        manuallyAddedPlayerIds,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.push(`/admin/finance/shared-expenses/${result.id}`);
      router.refresh();
    });
  }

  const titleEmpty = title.trim() === "";
  const submitDisabled =
    submitting ||
    !rows ||
    rows.length === 0 ||
    titleEmpty ||
    !Number.isInteger(totalAmountNum) ||
    totalAmountNum <= 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          פרטי החיוב
        </h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              כותרת
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: כדור חדש"
              className={`${inputBase} ${inputNormal}`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              תיאור (אופציונלי)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputBase} ${inputNormal}`}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                סכום (₪)
              </span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                min={1}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className={`${inputBase} ${inputNormal} tabular-nums`}
                dir="ltr"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                תקופת הסתכלות (שנים)
              </span>
              <input
                type="number"
                inputMode="decimal"
                step={0.5}
                min={0.5}
                value={lookbackYears}
                onChange={(e) => setLookbackYears(e.target.value)}
                className={`${inputBase} ${inputNormal} tabular-nums`}
                dir="ltr"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                אחוז השתתפות מינימלי (%)
              </span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                min={0}
                max={100}
                value={minAttendancePct}
                onChange={(e) => setMinAttendancePct(e.target.value)}
                className={`${inputBase} ${inputNormal} tabular-nums`}
                dir="ltr"
              />
            </label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              קהל יעד
            </legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="eligibility"
                  value="REGISTERED_ONLY"
                  checked={eligibilityPool === "REGISTERED_ONLY"}
                  onChange={() => setEligibilityPool("REGISTERED_ONLY")}
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-200">
                  שחקנים רשומים בלבד
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="eligibility"
                  value="ALL_PLAYERS"
                  checked={eligibilityPool === "ALL_PLAYERS"}
                  onChange={() => setEligibilityPool("ALL_PLAYERS")}
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-200">
                  כל השחקנים
                </span>
              </label>
            </div>
          </fieldset>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={loadPreview}
              disabled={previewing}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {previewing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {rows ? "רענן תצוגה מקדימה" : "טען תצוגה מקדימה"}
            </button>
            {previewError && (
              <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
            )}
          </div>
        </div>
      </section>

      {rows && (
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              שחקנים בחיוב ({rows.length})
            </h2>
            <div className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300" dir="ltr">
              {split ? (
                <>
                  ₪{split.share}
                  {split.remainder > 0 ? `–₪${split.share + 1}` : ""} ×{" "}
                  {rows.length} = ₪{totalAmountNum}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              אין שחקנים בחיוב. הוסף ידנית למטה או רענן את התצוגה המקדימה.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r, idx) => {
                const perPlayer = split?.perPlayer[idx] ?? 0;
                return (
                  <li
                    key={r.playerId}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {r.name}
                        {r.playerKind === "DROP_IN" && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            דופ-אין
                          </span>
                        )}
                        {r.manuallyAdded && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            ידני
                          </span>
                        )}
                      </span>
                      <span
                        className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
                        dir="ltr"
                      >
                        {r.attendancePct !== null &&
                        r.sessionsTotal !== null &&
                        r.sessionsAttended !== null ? (
                          <>
                            {Math.round(r.sessionsAttended)}/
                            {Math.round(r.sessionsTotal)} (
                            {formatPct(r.attendancePct)}) ·{" "}
                          </>
                        ) : (
                          <>— · </>
                        )}
                        <span
                          className={
                            r.currentBalance < 0
                              ? "text-red-600 dark:text-red-400"
                              : r.currentBalance > 0
                                ? "text-green-700 dark:text-green-400"
                                : ""
                          }
                        >
                          {r.currentBalance >= 0 ? "+" : ""}₪{r.currentBalance}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
                        dir="ltr"
                      >
                        ₪{perPlayer}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(r.playerId)}
                        aria-label={`הסר ${r.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-2 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              הוסף שחקן ידני (גם אם אינו עומד בקריטריונים)
            </span>
            <div className="flex gap-2">
              <input
                type="search"
                value={addPlayerSearch}
                onChange={(e) => setAddPlayerSearch(e.target.value)}
                placeholder="חפש שחקן…"
                className={`${inputBase} ${inputNormal} flex-1 text-sm`}
              />
              <select
                value={addPlayerSelection}
                onChange={(e) => {
                  setAddPlayerSelection(e.target.value);
                }}
                className={`${inputBase} ${inputNormal} flex-1 text-sm`}
                aria-label="בחר שחקן"
              >
                <option value="">
                  {availableForAdd.length === 0 ? "אין שחקנים זמינים" : "בחר שחקן…"}
                </option>
                {availableForAdd.map((p) => (
                  <option key={p.playerId} value={p.playerId}>
                    {p.name}
                    {p.playerKind === "DROP_IN" ? " (דופ-אין)" : ""}
                    {p.currentBalance < 0 ? ` · ₪${p.currentBalance}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => addRow(addPlayerSelection)}
                disabled={!addPlayerSelection}
                aria-label="הוסף שחקן"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </section>
      )}

      {rows && (
        <section className="flex flex-col gap-3">
          {submitError && (
            <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            צור חיוב
          </button>
          {titleEmpty && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              יש להזין כותרת לפני שליחת החיוב.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
