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

  function toggleA(id: string, checked: boolean) {
    setTeamA((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleB(id: string, checked: boolean) {
    setTeamB((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            קבוצה א׳
          </legend>
          <div className="flex flex-col gap-1">
            {attendees.map((p) => {
              const inB = teamB.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm transition-colors ${
                    inB
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={teamA.has(p.id)}
                    disabled={inB || isPending}
                    onChange={(e) => toggleA(p.id, e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span>{p.displayName}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Team B */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            קבוצה ב׳
          </legend>
          <div className="flex flex-col gap-1">
            {attendees.map((p) => {
              const inA = teamA.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm transition-colors ${
                    inA
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={teamB.has(p.id)}
                    disabled={inA || isPending}
                    onChange={(e) => toggleB(p.id, e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span>{p.displayName}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Score */}
      <div className="flex items-center justify-center gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">קבוצה א׳</span>
          <input
            type="number"
            min="0"
            value={scoreA}
            onChange={(e) => setScoreA(Math.max(0, parseInt(e.target.value, 10) || 0))}
            disabled={isPending}
            className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-center text-lg font-semibold tabular-nums focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <span className="mt-4 text-xl font-bold text-zinc-400">:</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">קבוצה ב׳</span>
          <input
            type="number"
            min="0"
            value={scoreB}
            onChange={(e) => setScoreB(Math.max(0, parseInt(e.target.value, 10) || 0))}
            disabled={isPending}
            className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-center text-lg font-semibold tabular-nums focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(match.id)}
                      disabled={isPending}
                      title="מחק משחק"
                      className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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
