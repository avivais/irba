import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { getPlayerSession } from "@/lib/player-session";
import { fetchAllChallengeLeaderboards } from "@/app/challenges/data";
import { ChallengeCard } from "@/components/challenge-card";
import { PlayerNav } from "@/components/player-nav";

export const metadata: Metadata = { title: "תחרויות" };

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/");

  const results = await fetchAllChallengeLeaderboards();
  const active = results.find((r) => !r.challenge.isClosed) ?? null;
  const history = results.filter((r) => r.challenge.isClosed);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PlayerNav />
      <main className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">תחרויות</h1>
          </div>

          <div className="flex flex-col gap-8">
            {/* Active competition */}
            {active ? (
              <ChallengeCard
                number={active.challenge.number}
                isActive={active.challenge.isActive}
                isClosed={active.challenge.isClosed}
                startDate={active.challenge.startDate}
                sessionCount={active.challenge.sessionCount}
                minMatchesPct={active.challenge.minMatchesPct}
                completedSessions={active.completedSessions}
                winnerName={active.challenge.winner ? (active.challenge.winner.nickname ?? active.challenge.winner.firstNameHe ?? active.challenge.winner.phone) : null}
                leaderboard={active.leaderboard}
                currentPlayerId={session.playerId}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                אין תחרות פעילה כרגע.
              </p>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  היסטוריה
                </h2>
                <div className="flex flex-col gap-4">
                  {history.map((r) => (
                    <ChallengeCard
                      key={r.challenge.id}
                      number={r.challenge.number}
                      isActive={r.challenge.isActive}
                      isClosed={r.challenge.isClosed}
                      startDate={r.challenge.startDate}
                      sessionCount={r.challenge.sessionCount}
                      minMatchesPct={r.challenge.minMatchesPct}
                      completedSessions={r.completedSessions}
                      winnerName={r.challenge.winner ? (r.challenge.winner.nickname ?? r.challenge.winner.firstNameHe ?? r.challenge.winner.phone) : null}
                      leaderboard={r.leaderboard}
                      currentPlayerId={session.playerId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
