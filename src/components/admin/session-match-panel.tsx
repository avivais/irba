"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createMatchAction,
  updateMatchAction,
  deleteMatchAction,
} from "@/app/admin/(protected)/sessions/[id]/matches/actions";

type AttendeeOption = { id: string; displayName: string };

type MatchRow = {
  id: string;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  scoreA: number;
  scoreB: number;
  createdAt: Date;
};

type Props = {
  sessionId: string;
  attendees: AttendeeOption[];
  matches: MatchRow[];
};

type FormData = {
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  scoreA: number;
  scoreB: number;
};

const teamBtnBase =
  "h-10 w-12 rounded-lg border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const teamASelected =
  "border-transparent bg-blue-600 text-white dark:bg-blue-500";
const teamBSelected =
  "border-transparent bg-orange-500 text-white dark:bg-orange-400";
const teamUnselected =
  "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-700";

const stepperBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg font-bold text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600";

const scoreInput =
  "w-16 shrink-0 rounded-lg border border-zinc-300 bg-white py-2 text-center text-2xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function MatchForm({
  attendees,
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  attendees: AttendeeOption[];
  initial?: FormData;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [teamA, setTeamA] = useState<Set<string>>(
    new Set(initial?.teamAPlayerIds ?? []),
  );
  const [teamB, setTeamB] = useState<Set<string>>(
    new Set(initial?.teamBPlayerIds ?? []),
  );
  const [scoreA, setScoreA] = useState(initial?.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(initial?.scoreB ?? 0);

  function assignPlayer(id: string, team: "A" | "B") {
    const [setMine, setOther] =
      team === "A" ? [setTeamA, setTeamB] : [setTeamB, setTeamA];
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      next.add(id);
      return next;
    });
    setOther((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function adjustScore(
    setter: React.Dispatch<React.SetStateAction<number>>,
    delta: number,
  ) {
    setter((prev) => Math.max(0, prev + delta));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      teamAPlayerIds: [...teamA],
      teamBPlayerIds: [...teamB],
      scoreA,
      scoreB,
    });
  }

  const scoreRows = [
    { label: "קבוצה א׳", score: scoreA, setScore: setScoreA },
    { label: "קבוצה ב׳", score: scoreB, setScore: setScoreB },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── Player assignment ── */}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {attendees.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-1 py-2.5">
            <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200">
              {p.displayName}
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => assignPlayer(p.id, "A")}
                disabled={isPending}
                className={`${teamBtnBase} ${teamA.has(p.id) ? teamASelected : teamUnselected}`}
              >
                א׳
              </button>
              <button
                type="button"
                onClick={() => assignPlayer(p.id, "B")}
                disabled={isPending}
                className={`${teamBtnBase} ${teamB.has(p.id) ? teamBSelected : teamUnselected}`}
              >
                ב׳
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* ── Score steppers ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
        {scoreRows.map(({ label, score, setScore }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {label}
            </span>
            <button
              type="button"
              onClick={() => adjustScore(setScore, -1)}
              disabled={score === 0 || isPending}
              className={stepperBtn}
              aria-label={`הפחת ניקוד ${label}`}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={score}
              onChange={(e) =>
                setScore(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              disabled={isPending}
              className={scoreInput}
            />
            <button
              type="button"
              onClick={() => adjustScore(setScore, +1)}
              disabled={isPending}
              className={stepperBtn}
              aria-label={`הוסף ניקוד ${label}`}
            >
              +
            </button>
          </div>
        ))}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:w-auto sm:px-5"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 sm:w-auto sm:px-6"
        >
          {isPending ? "שומר..." : "שמור"}
        </button>
      </div>
    </form>
  );
}

function nameList(ids: string[], attendees: AttendeeOption[]): string {
  const map = new Map(attendees.map((a) => [a.id, a.displayName]));
  return ids.map((id) => map.get(id) ?? "?").join(", ");
}

function ScoreDisplay({
  scoreA,
  scoreB,
}: {
  scoreA: number;
  scoreB: number;
}) {
  const aWins = scoreA > scoreB;
  const bWins = scoreB > scoreA;
  return (
    <span
      className="shrink-0 font-mono text-base tabular-nums"
      dir="ltr"
    >
      <span
        className={
          aWins
            ? "font-bold text-green-600 dark:text-green-400"
            : bWins
              ? "text-zinc-400"
              : "text-zinc-700 dark:text-zinc-300"
        }
      >
        {scoreA}
      </span>
      <span className="mx-0.5 text-zinc-400">:</span>
      <span
        className={
          bWins
            ? "font-bold text-green-600 dark:text-green-400"
            : aWins
              ? "text-zinc-400"
              : "text-zinc-700 dark:text-zinc-300"
        }
      >
        {scoreB}
      </span>
    </span>
  );
}

function computeNextMatchDefaults(
  matches: MatchRow[],
  attendees: AttendeeOption[],
): FormData | null {
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  // Tied — can't determine winner
  if (last.scoreA === last.scoreB) return null;
  const winnerIds = last.scoreA > last.scoreB ? last.teamAPlayerIds : last.teamBPlayerIds;
  const playedIds = new Set([...last.teamAPlayerIds, ...last.teamBPlayerIds]);
  const sittingOut = attendees.filter((a) => !playedIds.has(a.id)).map((a) => a.id);
  return { teamAPlayerIds: winnerIds, teamBPlayerIds: sittingOut, scoreA: 0, scoreB: 0 };
}

export function SessionMatchPanel({
  sessionId,
  attendees,
  matches: initialMatches,
}: Props) {
  const [matches, setMatches] = useState(initialMatches);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMatchInitial, setNewMatchInitial] = useState<FormData | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() {
    setEditingId(null);
    setError(null);
    const defaults = computeNextMatchDefaults(matches, attendees);
    setNewMatchInitial(defaults ?? undefined);
    setShowNewForm(true);
  }

  function openEdit(id: string) {
    setShowNewForm(false);
    setEditingId(id);
    setError(null);
  }

  function closeAll() {
    setShowNewForm(false);
    setEditingId(null);
    setError(null);
  }

  function handleCreate(data: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createMatchAction(
        sessionId,
        data.teamAPlayerIds,
        data.teamBPlayerIds,
        data.scoreA,
        data.scoreB,
      );
      if (!result.ok) {
        setError(result.message ?? "שגיאה");
        return;
      }
      window.location.reload();
    });
  }

  function handleUpdate(matchId: string, data: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateMatchAction(
        matchId,
        sessionId,
        data.teamAPlayerIds,
        data.teamBPlayerIds,
        data.scoreA,
        data.scoreB,
      );
      if (!result.ok) {
        setError(result.message ?? "שגיאה");
        return;
      }
      window.location.reload();
    });
  }

  function handleDelete(matchId: string) {
    if (!window.confirm("למחוק את המשחק?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMatchAction(matchId, sessionId);
      if (!result.ok) {
        setError(result.message ?? "שגיאה");
        return;
      }
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
          משחקים
        </h2>
        <button
          onClick={openNew}
          disabled={attendees.length === 0 || isPending}
          title={attendees.length === 0 ? "אין שחקנים מאושרים במפגש" : "הוסף משחק"}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {/* New match form */}
      {showNewForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              משחק חדש
            </p>
            {newMatchInitial && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                (מולאו אוטומטית — ניתן לשנות)
              </span>
            )}
          </div>
          <MatchForm
            attendees={attendees}
            initial={newMatchInitial}
            onSubmit={handleCreate}
            onCancel={closeAll}
            isPending={isPending}
          />
        </div>
      )}

      {/* Match list */}
      {matches.length === 0 && !showNewForm ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">אין משחקים רשומים</p>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((match, index) => (
            <div key={match.id}>
              {editingId === match.id ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    עריכת משחק #{index + 1}
                  </p>
                  <MatchForm
                    attendees={attendees}
                    initial={{
                      teamAPlayerIds: match.teamAPlayerIds,
                      teamBPlayerIds: match.teamBPlayerIds,
                      scoreA: match.scoreA,
                      scoreB: match.scoreB,
                    }}
                    onSubmit={(data) => handleUpdate(match.id, data)}
                    onCancel={closeAll}
                    isPending={isPending}
                  />
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                  {/* Match number */}
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    #{index + 1}
                  </span>

                  {/* Teams + score */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-0 truncate text-sm text-zinc-700 dark:text-zinc-300">
                        {nameList(match.teamAPlayerIds, attendees)}
                      </span>
                      <ScoreDisplay scoreA={match.scoreA} scoreB={match.scoreB} />
                      <span className="min-w-0 truncate text-sm text-zinc-700 dark:text-zinc-300">
                        {nameList(match.teamBPlayerIds, attendees)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(match.id)}
                      disabled={isPending}
                      title="ערוך משחק"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(match.id)}
                      disabled={isPending}
                      title="מחק משחק"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
