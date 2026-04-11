"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ShieldCheck, LogOut, MessageCircle, ListOrdered, Trophy } from "lucide-react";
import { playerLogoutAction } from "@/app/actions/player-auth";
import { WaStatusDot } from "@/components/admin/wa-status-dot";

const linkCls =
  "flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const activeCls =
  "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const onProfile = pathname === "/profile";
  const onPrecedence = pathname === "/precedence";
  const onChallenges = pathname.startsWith("/challenges");
  const onWaPage = pathname === "/admin/wa";
  const onAdminPage = pathname.startsWith("/admin") && !onWaPage;

  return (
    <>
      <Link
        href="/profile"
        className={`${linkCls} ${onProfile ? activeCls : ""}`}
        aria-label="אזור אישי"
        aria-current={onProfile ? "page" : undefined}
      >
        <User className="h-4 w-4" aria-hidden />
      </Link>

      <Link
        href="/precedence"
        className={`${linkCls} ${onPrecedence ? activeCls : ""}`}
        aria-label="רשימת קדימות"
        aria-current={onPrecedence ? "page" : undefined}
      >
        <ListOrdered className="h-4 w-4" aria-hidden />
      </Link>

      <Link
        href="/challenges"
        className={`${linkCls} ${onChallenges ? activeCls : ""}`}
        aria-label="תחרויות"
        aria-current={onChallenges ? "page" : undefined}
      >
        <Trophy className="h-4 w-4" aria-hidden />
      </Link>

      {isAdmin && (
        <>
          <Link
            href="/admin/wa"
            className={`${linkCls} relative overflow-visible ${onWaPage ? activeCls : ""}`}
            aria-label="וואטסאפ"
            aria-current={onWaPage ? "page" : undefined}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            <WaStatusDot />
          </Link>
          <Link
            href="/admin"
            className={`${linkCls} ${onAdminPage ? activeCls : ""}`}
            aria-label="ניהול"
            aria-current={onAdminPage ? "page" : undefined}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </Link>
        </>
      )}

      <form action={playerLogoutAction}>
        <button
          type="submit"
          className={`${linkCls} text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300`}
          aria-label="התנתק"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </>
  );
}
