"use client";

import { useState } from "react";
import { Shuffle, Copy, Check } from "lucide-react";
import { generateTeamOptions, type TeamOption } from "@/lib/team-balance";

type AttendeeWithRank = {
  id: string;
  displayName: string;
  rank: number | null;
  positions: string[];
};

type Props = {
  attendees: AttendeeWithRank[];
  defaultRank: number;
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
      aria-label="העתק לוואטסאפ"
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

export function TeamBalancePanel({ attendees, defaultRank }: Props) {
  const [options, setOptions] = useState<TeamOption[] | null>(null);
  const canGenerate = attendees.length >= 3;

  function handleGenerate() {
    const players = attendees.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      rank: a.rank ?? defaultRank,
      positions: a.positions,
    }));
    setOptions(generateTeamOptions(players, Math.floor(Math.random() * 0xffffffff)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">קבוצות מאוזנות</h2>
      </div>

      {!canGenerate ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">נדרשים לפחות 3 שחקנים מאושרים.</p>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 sm:w-auto"
        >
          <Shuffle className="h-4 w-4" aria-hidden />
          {options ? "ערבב מחדש" : "צור קבוצות"}
        </button>
      )}

      {options && (
        <div className="flex flex-col gap-4">
          {options.map((opt, optIdx) => (
            <div
              key={optIdx}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  אפשרות {optIdx + 1}
                </span>
                <CopyButton text={buildCopyText(opt)} />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                {opt.teams.map((team, teamIdx) => (
                  <div key={teamIdx} className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {TEAM_LABELS[teamIdx]}
                      </span>
                      <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                        ניקוד: {team.rankSum}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {team.players.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-1.5 text-sm text-zinc-800 dark:text-zinc-200"
                        >
                          <span className="truncate">{p.displayName}</span>
                          {p.positions.map((pos) => (
                            <span
                              key={pos}
                              className="shrink-0 rounded bg-zinc-200 px-1 py-0.5 font-mono text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                            >
                              {pos}
                            </span>
                          ))}
                          <span className="ml-auto shrink-0 tabular-nums text-xs text-zinc-400 dark:text-zinc-500">
                            {p.rank}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
