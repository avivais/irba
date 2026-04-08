"use client";

import { useState } from "react";
import { Shuffle, Copy, Check, Send } from "lucide-react";
import { generateTeamOptions, ALL_POSITIONS, type TeamOption } from "@/lib/team-balance";
import { sendTeamOptionsAction } from "@/app/admin/(protected)/sessions/[id]/actions";

type AttendeeWithRank = {
  id: string;
  displayName: string;
  rank: number | null;
  positions: string[];
};

type Props = {
  attendees: AttendeeWithRank[];
  defaultRank: number;
  sessionDate: Date;
  sessionId: string;
};

const TEAM_LABELS = ["קבוצה א׳", "קבוצה ב׳", "קבוצה ג׳"] as const;

function buildCopyText(opt: TeamOption): string {
  return opt.teams
    .map((team, i) => {
      const names = team.players.map((p) => p.displayName).join(", ");
      return `${TEAM_LABELS[i]} (ניקוד: ${team.rankSum}):\n${names}`;
    })
    .join("\n\n");
}

function buildWAMessage(opt: TeamOption, idx: number): string {
  const lines = [`אפשרות ${idx + 1}`];
  opt.teams.forEach((team, i) => {
    lines.push(`${TEAM_LABELS[i]}: ${team.players.map((p) => p.displayName).join(", ")}`);
  });
  return lines.join("\n");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      aria-label="העתק"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" aria-hidden />
          הועתק
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          העתק
        </>
      )}
    </button>
  );
}

export function TeamBalancePanel({ attendees, defaultRank, sessionDate, sessionId }: Props) {
  const [options, setOptions] = useState<TeamOption[] | null>(null);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const canGenerate = attendees.length >= 3;

  function handleGenerate() {
    const players = attendees.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      rank: a.rank ?? defaultRank,
      positions: a.positions,
    }));
    setOptions(generateTeamOptions(players, Math.floor(Math.random() * 0xffffffff)));
    setSendState("idle");
    setSendError(null);
  }

  async function handleSendToWA() {
    if (!options || options.length === 0) return;
    setSendState("sending");
    setSendError(null);

    const d = new Date(sessionDate);
    const pollQuestion = `כוחות ל-${d.getDate()}.${d.getMonth() + 1}`;
    const messages = options.map((opt, i) => buildWAMessage(opt, i));
    const pollOptions = options.map((_, i) => `אפשרות ${i + 1}`);

    const result = await sendTeamOptionsAction(sessionId, messages, pollQuestion, pollOptions);
    if (result.ok) {
      setSendState("sent");
      setTimeout(() => setSendState("idle"), 3000);
    } else {
      setSendState("error");
      setSendError(result.error ?? "שליחה נכשלה");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">קבוצות מאוזנות</h2>
      </div>

      {!canGenerate ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">נדרשים לפחות 3 שחקנים מאושרים.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Shuffle className="h-4 w-4" aria-hidden />
            {options ? "ערבב מחדש" : "צור קבוצות"}
          </button>

          {options && options.length > 0 && (
            <button
              type="button"
              onClick={handleSendToWA}
              disabled={sendState === "sending"}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-100 active:bg-green-200 disabled:opacity-60 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
            >
              {sendState === "sending" ? (
                <>שולח...</>
              ) : sendState === "sent" ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  נשלח
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden />
                  שלח לוואטסאפ
                </>
              )}
            </button>
          )}
        </div>
      )}

      {sendState === "error" && sendError && (
        <p className="text-sm text-red-500 dark:text-red-400">{sendError}</p>
      )}

      {options && options.length === 0 && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          לא ניתן ליצור קבוצות עם כיסוי עמדות מלא עבור השחקנים הנוכחיים. נסה לערבב מחדש או עדכן את עמדות השחקנים.
        </p>
      )}

      {options && options.length > 0 && (
        <div className="flex flex-col gap-4">
          {options.map((opt, optIdx) => {
            // Build position → player lookup per team
            const posMaps = opt.teams.map((team) => {
              const map: Record<string, (typeof team.players)[number] | undefined> = {};
              for (const p of team.players) {
                const pos = team.positionAssignment[p.id];
                if (pos) map[pos] = p;
              }
              return map;
            });

            // Players without a position assignment (e.g. team has > 5 or position overlap)
            const unassigned = opt.teams.map((team) =>
              team.players.filter((p) => !team.positionAssignment[p.id])
            );
            const hasUnassigned = unassigned.some((u) => u.length > 0);

            return (
              <div
                key={optIdx}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                {/* Option header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    אפשרות {optIdx + 1}
                  </span>
                  <CopyButton text={buildCopyText(opt)} />
                </div>

                {/* Team name + rank sum headers */}
                <div className="grid grid-cols-3 gap-x-3 border-b border-zinc-200 pb-2 dark:border-zinc-700">
                  {opt.teams.map((team, teamIdx) => (
                    <div key={teamIdx} className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {TEAM_LABELS[teamIdx]}
                      </span>
                      <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                        {team.rankSum}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Position rows: one row per position, one cell per team */}
                <div className="flex flex-col">
                  {ALL_POSITIONS.map((pos, posIdx) => (
                    <div
                      key={pos}
                      className={`grid grid-cols-3 gap-x-3 py-1${posIdx > 0 ? " border-t border-zinc-100 dark:border-zinc-700/50" : ""}`}
                    >
                      {opt.teams.map((_, teamIdx) => {
                        const player = posMaps[teamIdx][pos];
                        return (
                          <div
                            key={teamIdx}
                            className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-800 dark:text-zinc-200"
                          >
                            <span className="shrink-0 rounded bg-zinc-200 px-1 py-0.5 font-mono text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                              {pos}
                            </span>
                            {player ? (
                              <>
                                <span className="truncate">{player.displayName}</span>
                                <span className="ml-auto shrink-0 tabular-nums text-xs text-zinc-400 dark:text-zinc-500">
                                  {player.rank}
                                </span>
                              </>
                            ) : (
                              <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Players without a position (overflow or unresolvable conflicts) */}
                {hasUnassigned && (
                  <div className="grid grid-cols-3 gap-x-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                    {unassigned.map((players, teamIdx) => (
                      <div key={teamIdx} className="flex flex-col gap-0.5">
                        {players.map((p) => (
                          <div
                            key={p.id}
                            className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400"
                          >
                            <span className="truncate">{p.displayName}</span>
                            <span className="ml-auto shrink-0 tabular-nums text-xs text-zinc-400">
                              {p.rank}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
