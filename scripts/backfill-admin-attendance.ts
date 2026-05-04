/**
 * One-shot backfill: ensure admin players have Attendance for every session,
 * and SessionCharge + matching Payment for every charged session.
 *
 * Idempotent — safe to run multiple times. Existing rows are not touched.
 *
 * Usage:
 *   npx tsx scripts/backfill-admin-attendance.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const admins = await prisma.player.findMany({
    where: { isAdmin: true },
    select: { id: true, firstNameHe: true },
  });
  if (admins.length === 0) {
    console.log("No admin players. Nothing to do.");
    return;
  }

  const sessions = await prisma.gameSession.findMany({
    select: { id: true, date: true, isCharged: true },
    orderBy: { date: "asc" },
  });

  let attendanceAdded = 0;
  let chargeAdded = 0;
  let paymentAdded = 0;
  let chargesSkipped = 0;

  for (const admin of admins) {
    for (const s of sessions) {
      const dateStr = s.date.toISOString().slice(0, 10);

      // 1) Attendance
      const existingAttendance = await prisma.attendance.findUnique({
        where: {
          playerId_gameSessionId: {
            playerId: admin.id,
            gameSessionId: s.id,
          },
        },
        select: { id: true },
      });
      if (!existingAttendance) {
        await prisma.attendance.create({
          data: { playerId: admin.id, gameSessionId: s.id },
        });
        attendanceAdded++;
        console.log(`+ attendance ${dateStr} (${admin.firstNameHe})`);
      }

      // 2) For charged sessions: ensure SessionCharge + matching Payment
      if (s.isCharged) {
        const existingCharge = await prisma.sessionCharge.findUnique({
          where: {
            sessionId_playerId: { sessionId: s.id, playerId: admin.id },
          },
          select: { id: true, amount: true },
        });

        let chargeAmount: number;
        if (existingCharge) {
          chargeAmount = existingCharge.amount;
        } else {
          const ref = await prisma.sessionCharge.findFirst({
            where: { sessionId: s.id, chargeType: "REGISTERED" },
            select: { amount: true },
          });
          if (!ref) {
            console.warn(
              `! ${dateStr}: no REGISTERED reference charge — skipping charge`,
            );
            chargesSkipped++;
            continue;
          }
          chargeAmount = ref.amount;
          await prisma.sessionCharge.create({
            data: {
              sessionId: s.id,
              playerId: admin.id,
              amount: chargeAmount,
              calculatedAmount: chargeAmount,
              chargeType: "REGISTERED",
            },
          });
          chargeAdded++;
          console.log(
            `+ charge ₪${chargeAmount} ${dateStr} (${admin.firstNameHe})`,
          );
        }

        // Matching auto-payment (idempotent: skip if any payment exists for
        // this admin × session pair)
        const existingPayment = await prisma.payment.findFirst({
          where: { playerId: admin.id, sessionId: s.id },
          select: { id: true },
        });
        if (!existingPayment) {
          await prisma.payment.create({
            data: {
              playerId: admin.id,
              sessionId: s.id,
              amount: chargeAmount,
              method: "OTHER",
              description: "קיזוז מנהל",
              date: s.date,
            },
          });
          paymentAdded++;
          console.log(
            `+ payment ₪${chargeAmount} ${dateStr} (${admin.firstNameHe})`,
          );
        }
      }
    }
  }

  console.log("");
  console.log("=== Summary ===");
  console.log(`Attendances created: ${attendanceAdded}`);
  console.log(`Session charges created: ${chargeAdded}`);
  console.log(`Payments created: ${paymentAdded}`);
  if (chargesSkipped > 0) {
    console.log(`Charges skipped (no reference): ${chargesSkipped}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
