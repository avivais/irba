import Link from "next/link";
import { Home, User, ShieldCheck, LogOut } from "lucide-react";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { getPlayerDisplayName } from "@/lib/player-display";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/theme-toggle";
import { playerLogoutAction } from "@/app/actions/player-auth";

const linkCls =
  "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export async function PlayerNav() {
  const playerId = await getPlayerSessionPlayerId();

  const player = playerId
    ? await prisma.player.findUnique({
        where: { id: playerId },
        select: {
          firstNameHe: true,
          lastNameHe: true,
          firstNameEn: true,
          lastNameEn: true,
          nickname: true,
          phone: true,
          isAdmin: true,
        },
      })
    : null;

  const displayName = player ? getPlayerDisplayName(player) : null;

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 md:max-w-4xl md:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="text-base font-bold text-zinc-900 dark:text-zinc-50"
        >
          IRBA
        </Link>

        {/* Nav actions */}
        <div className="flex items-center gap-0.5">
          {player ? (
            <>
              <Link href="/" className={linkCls} aria-label="דף הבית">
                <Home className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">דף הבית</span>
              </Link>

              <Link href="/profile" className={linkCls}>
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="max-w-[7rem] truncate">{displayName}</span>
              </Link>

              {player.isAdmin && (
                <Link href="/admin" className={linkCls} aria-label="ניהול">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">ניהול</span>
                </Link>
              )}

              <form action={playerLogoutAction}>
                <button
                  type="submit"
                  className={`${linkCls} text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300`}
                  aria-label="התנתק"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">התנתק</span>
                </button>
              </form>
            </>
          ) : null}

          <div className="ms-1">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
