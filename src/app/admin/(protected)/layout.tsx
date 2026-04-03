import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { prisma } from "@/lib/prisma";
import { PlayerNav } from "@/components/player-nav";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const subject = await getAdminSessionSubject();
  if (!subject) {
    // Fall back to checking if an isAdmin player is logged in
    const playerId = await getPlayerSessionPlayerId();
    if (playerId) {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { isAdmin: true },
      });
      if (!player?.isAdmin) {
        redirect("/");
      }
      // isAdmin player — allow through
    } else {
      redirect("/");
    }
  }
  return (
    <div className="flex min-h-full flex-col">
      <PlayerNav />
      {children}
      <footer className="mt-auto py-4 text-center text-xs text-zinc-300 dark:text-zinc-700" dir="ltr">
        {process.env.NEXT_PUBLIC_COMMIT_HASH ?? "dev"}
        {process.env.NEXT_PUBLIC_COMMIT_DATE && (
          <span> · {process.env.NEXT_PUBLIC_COMMIT_DATE}</span>
        )}
      </footer>
    </div>
  );
}
