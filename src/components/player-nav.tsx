import Link from "next/link";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { prisma } from "@/lib/prisma";
import { NavLinks } from "@/components/nav-links";

export async function PlayerNav() {
  const playerId = await getPlayerSessionPlayerId();

  const player = playerId
    ? await prisma.player.findUnique({
        where: { id: playerId },
        select: { isAdmin: true },
      })
    : null;

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 md:max-w-4xl md:px-6">
        {/* Brand — also the home link */}
        <Link
          href="/"
          className="text-base font-bold text-zinc-900 dark:text-zinc-50"
        >
          IRBA
        </Link>

        {/* Nav actions — only shown when logged in */}
        {player && (
          <div className="flex items-center gap-0.5">
            <NavLinks isAdmin={player.isAdmin} />
          </div>
        )}
      </div>
    </nav>
  );
}
