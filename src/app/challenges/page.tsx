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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PlayerNav />
      <main className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">תחרויות</h1>
          </div>

          {results.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              אין תחרויות פעילות כרגע.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {results.map((r) => (
                <ChallengeCard
                  key={r.challenge.id}
                  title={r.challenge.title}
                  metric={r.challenge.metric}
                  prize={r.challenge.prize}
                  isActive={r.challenge.isActive}
                  windowLabel={r.windowLabel}
                  sessionCount={r.sessionCount}
                  leaderboard={r.leaderboard}
                  currentPlayerId={session.playerId}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
