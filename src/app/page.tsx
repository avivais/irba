import { CalendarDays, MapPin, Users } from "lucide-react";
import { CancelRsvpForm } from "@/components/cancel-rsvp-form";
import { AuthenticatedRsvpForm } from "@/components/authenticated-rsvp-form";
import { PlayerLoginForm } from "@/components/player-login-form";
import { PlayerNav } from "@/components/player-nav";
import { formatGameDate } from "@/lib/format-date";
import { getNextGame } from "@/lib/game";
import { getConfigInt, CONFIG } from "@/lib/config";
import { maskPhone } from "@/lib/mask-phone";
import { getPlayerDisplayName } from "@/lib/player-display";
import { prisma } from "@/lib/prisma";
import { getSessionPlayerId } from "@/lib/rsvp-session";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { sortAttendancesByPrecedence } from "@/lib/sort-attendances";

import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "IRBA · המפגש הבא" } };

/** RSVP reads live DB state — do not prerender at build time without a database. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [game, closeHours, sessionPlayerId, authenticatedPlayerId] =
    await Promise.all([
      getNextGame(),
      getConfigInt(CONFIG.RSVP_CLOSE_HOURS),
      getSessionPlayerId(),
      getPlayerSessionPlayerId(),
    ]);

  const authenticatedPlayer = authenticatedPlayerId
    ? await prisma.player.findUnique({
        where: { id: authenticatedPlayerId },
        select: {
          firstNameHe: true,
          lastNameHe: true,
          firstNameEn: true,
          lastNameEn: true,
          nickname: true,
          phone: true,
        },
      })
    : null;

  const authDisplayName = authenticatedPlayer
    ? getPlayerDisplayName(authenticatedPlayer)
    : "";

  const nowMs = new Date().getTime();

  // Registration open until session starts (not just the close window)
  const isRsvpOpen =
    game !== null &&
    !game.isClosed &&
    nowMs < game.date.getTime();

  const rawAttendances = game
    ? await prisma.attendance.findMany({
        where: { gameSessionId: game.id },
        orderBy: { createdAt: "asc" },
        include: { player: true },
      })
    : [];

  const attendances = game
    ? await sortAttendancesByPrecedence(rawAttendances, game.date.getFullYear())
    : [];

  const max = game?.maxPlayers ?? 15;
  const confirmed = attendances.slice(0, max);
  const waiting = attendances.slice(max);

  const userAttendance =
    (sessionPlayerId ? attendances.find((a) => a.playerId === sessionPlayerId) : null) ??
    (authenticatedPlayerId ? attendances.find((a) => a.playerId === authenticatedPlayerId) : null);
  const userIsAttending = !!userAttendance;

  // Waitlisted players can always cancel; confirmed players cannot cancel within the close window
  const userIsWaitlisted = userAttendance
    ? attendances.indexOf(userAttendance) >= max
    : false;
  const withinCloseWindow =
    game !== null && nowMs >= game.date.getTime() - closeHours * 3_600_000;
  const canCancel = userIsAttending && (userIsWaitlisted || !withinCloseWindow);

  return (
    <>
      <PlayerNav />
      <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        <header className="mx-auto w-full max-w-lg text-center md:max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            המפגש הבא
          </h1>
        </header>

        <section
          className="mx-auto mt-8 w-full max-w-lg md:max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-labelledby="game-date-heading"
        >
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays
              className="h-5 w-5 shrink-0 text-green-700 dark:text-green-500"
              aria-hidden
            />
            <h2 id="game-date-heading" className="text-lg font-semibold">
              מועד המפגש
            </h2>
          </div>
          {game ? (
            <p className="text-base text-zinc-700 dark:text-zinc-300">
              {formatGameDate(game.date)}
            </p>
          ) : (
            <p className="text-base text-zinc-600 dark:text-zinc-400">
              אין מפגש מתוזמן
            </p>
          )}
        </section>

        {game && (game.locationName || (game.locationLat && game.locationLng)) && (
          <section
            className="mx-auto mt-4 w-full max-w-lg md:max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-labelledby="game-location-heading"
          >
            <div className="flex items-center gap-2 mb-3">
              <MapPin
                className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden
              />
              <h2 id="game-location-heading" className="text-lg font-semibold">
                מיקום
              </h2>
            </div>
            <div>
                {game.locationName && (
                  <p className="mb-3 text-base text-zinc-700 dark:text-zinc-300">
                    {game.locationName}
                  </p>
                )}
                {game.locationLat && game.locationLng && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`https://waze.com/ul?ll=${game.locationLat},${game.locationLng}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-600 active:bg-sky-700"
                      >
                        נווט עם Waze
                      </a>
                      <a
                        href={`https://www.google.com/maps?q=${game.locationLat},${game.locationLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        Google Maps ↗
                      </a>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <iframe
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${game.locationLng - 0.005},${game.locationLat - 0.005},${game.locationLng + 0.005},${game.locationLat + 0.005}&layer=mapnik&marker=${game.locationLat},${game.locationLng}`}
                        width="100%"
                        height="180"
                        style={{ border: 0 }}
                        title="מפה"
                        loading="lazy"
                      />
                    </div>
                  </>
                )}
            </div>
          </section>
        )}

        {!authenticatedPlayer && (
          <section className="mx-auto mt-8 w-full max-w-lg md:max-w-2xl">
            <h2 className="sr-only">כניסה לחשבון</h2>
            <PlayerLoginForm redirectTo="/" />
          </section>
        )}

        {game && isRsvpOpen && !userIsAttending && authenticatedPlayer && (
          <section className="mx-auto mt-8 w-full max-w-lg md:max-w-2xl">
            <h2 className="sr-only">הרשמה</h2>
            <AuthenticatedRsvpForm playerName={authDisplayName} />
          </section>
        )}

        {game && !isRsvpOpen && (
          <section className="mx-auto mt-8 w-full max-w-lg md:max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
              ההרשמה למפגש זה נסגרה
            </p>
          </section>
        )}

        {userIsAttending && canCancel && (
          <section
            className="mx-auto mt-6 w-full max-w-lg md:max-w-2xl"
            aria-labelledby="cancel-heading"
          >
            <h2 id="cancel-heading" className="sr-only">
              ביטול הגעה
            </h2>
            <CancelRsvpForm />
          </section>
        )}

        {userIsAttending && !canCancel && (
          <section className="mx-auto mt-6 w-full max-w-lg md:max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30">
            <p className="text-center text-sm text-amber-800 dark:text-amber-300">
              ביטול הרשמה אינו אפשרי בשלב זה — פנה למנהל
            </p>
          </section>
        )}

        {userIsAttending && userAttendance && (
          <p className="mx-auto mt-2 w-full max-w-lg text-center text-xs text-zinc-500 dark:text-zinc-400 md:max-w-2xl">
            נרשמת למפגש זה ב-{formatGameDate(userAttendance.createdAt)}
          </p>
        )}

        {game && (
          <section
            className="mx-auto mt-10 w-full max-w-lg md:max-w-2xl"
            aria-live="polite"
            aria-label="רשימת משתתפים"
          >
            <div className="mb-4 flex items-center gap-2">
              <Users
                className="h-5 w-5 text-zinc-600 dark:text-zinc-400"
                aria-hidden
              />
              <h2 className="text-lg font-semibold">מגיעים</h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                ({confirmed.length}/{max})
              </span>
            </div>
            {confirmed.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                עדיין אין נרשמים.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {confirmed.map((row, index) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2.5 text-start shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="flex flex-wrap items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                      <span>
                        {index + 1}. {getPlayerDisplayName(row.player)}
                      </span>
                      {row.player.playerKind === "DROP_IN" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                          מזדמן
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
                      {maskPhone(row.player.phone)}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {waiting.length > 0 && (
              <div id="waiting-list" className="mt-8">
                <h3 className="mb-3 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                  רשימת המתנה
                </h3>
                <ol className="flex flex-col gap-2">
                  {waiting.map((row, index) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-start dark:border-amber-900/50 dark:bg-amber-950/40"
                    >
                      <span className="flex flex-wrap items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                        <span>
                          {index + 1}. {getPlayerDisplayName(row.player)}
                        </span>
                        {row.player.playerKind === "DROP_IN" && (
                          <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-xs font-normal text-amber-950 dark:bg-amber-800/50 dark:text-amber-100">
                            מזדמן
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
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
    </>
  );
}
