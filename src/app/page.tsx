import { CalendarDays, Users } from "lucide-react";
import { CancelRsvpForm } from "@/components/cancel-rsvp-form";
import { RsvpForm } from "@/components/rsvp-form";
import { formatGameDate } from "@/lib/format-date";
import { getNextGame } from "@/lib/game";
import { maskPhone } from "@/lib/mask-phone";
import { prisma } from "@/lib/prisma";
import { getSessionPlayerId } from "@/lib/rsvp-session";

/** RSVP reads live DB state — do not prerender at build time without a database. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const game = await getNextGame();
  const sessionPlayerId = await getSessionPlayerId();

  const attendances = game
    ? await prisma.attendance.findMany({
        where: { gameSessionId: game.id },
        orderBy: { createdAt: "asc" },
        include: { player: true },
      })
    : [];

  const max = game?.maxPlayers ?? 15;
  const confirmed = attendances.slice(0, max);
  const waiting = attendances.slice(max);

  const userIsAttending =
    !!sessionPlayerId &&
    attendances.some((a) => a.playerId === sessionPlayerId);

  return (
    <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto w-full max-w-lg text-center">
        <p className="text-sm font-medium text-zinc-500">אילון רמון כדורסל</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          האימון הבא
        </h1>
      </header>

      <section
        className="mx-auto mt-8 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        aria-labelledby="game-date-heading"
      >
        <div className="flex items-start gap-3">
          <CalendarDays
            className="mt-0.5 h-6 w-6 shrink-0 text-green-700"
            aria-hidden
          />
          <div>
            <h2 id="game-date-heading" className="text-lg font-semibold">
              מועד האימון
            </h2>
            {game ? (
              <p className="mt-1 text-base text-zinc-700">
                {formatGameDate(game.date)}
              </p>
            ) : (
              <p className="mt-1 text-base text-zinc-600">אין אימון מתוזמן</p>
            )}
          </div>
        </div>
      </section>

      {game && !game.isClosed && (
        <section className="mx-auto mt-8 w-full max-w-lg">
          <h2 className="sr-only">הרשמה</h2>
          <RsvpForm />
        </section>
      )}

      {game && userIsAttending && (
        <section
          className="mx-auto mt-6 w-full max-w-lg"
          aria-labelledby="cancel-heading"
        >
          <h2 id="cancel-heading" className="sr-only">
            ביטול הגעה
          </h2>
          <CancelRsvpForm />
        </section>
      )}

      {game && (
        <section
          className="mx-auto mt-10 w-full max-w-lg"
          aria-live="polite"
          aria-label="רשימת משתתפים"
        >
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-zinc-600" aria-hidden />
            <h2 className="text-lg font-semibold">מגיעים</h2>
            <span className="text-sm text-zinc-500">
              ({confirmed.length}/{max})
            </span>
          </div>
          {confirmed.length === 0 ? (
            <p className="text-zinc-600">עדיין אין נרשמים.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {confirmed.map((row, index) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2.5 text-start shadow-sm"
                >
                  <span className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                    <span>
                      {index + 1}. {row.player.name}
                    </span>
                    {row.player.playerKind === "DROP_IN" && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
                        אורח
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-zinc-500 tabular-nums">
                    {maskPhone(row.player.phone)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {waiting.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-base font-semibold text-zinc-800">
                רשימת המתנה
              </h3>
              <ol className="flex flex-col gap-2">
                {waiting.map((row, index) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-start"
                  >
                    <span className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                      <span>
                        {index + 1}. {row.player.name}
                      </span>
                      {row.player.playerKind === "DROP_IN" && (
                        <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-xs font-normal text-amber-950">
                          אורח
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-zinc-500 tabular-nums">
                      {maskPhone(row.player.phone)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
