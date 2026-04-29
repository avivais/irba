-- CreateEnum
CREATE TYPE "EligibilityPool" AS ENUM ('REGISTERED_ONLY', 'ALL_PLAYERS');

-- CreateTable: SharedExpense
CREATE TABLE "SharedExpense" (
  "id"               TEXT             NOT NULL,
  "title"            TEXT             NOT NULL,
  "description"      TEXT,
  "totalAmount"      INTEGER          NOT NULL,
  "lookbackYears"    DOUBLE PRECISION NOT NULL,
  "minAttendancePct" DOUBLE PRECISION NOT NULL,
  "eligibilityPool"  "EligibilityPool" NOT NULL,
  "createdById"      TEXT             NOT NULL,
  "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revertedAt"       TIMESTAMP(3),

  CONSTRAINT "SharedExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SharedExpenseCharge
CREATE TABLE "SharedExpenseCharge" (
  "id"              TEXT         NOT NULL,
  "sharedExpenseId" TEXT         NOT NULL,
  "playerId"        TEXT         NOT NULL,
  "amount"          INTEGER      NOT NULL,
  "manuallyAdded"   BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SharedExpenseCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedExpense_createdAt_idx" ON "SharedExpense"("createdAt");
CREATE UNIQUE INDEX "SharedExpenseCharge_sharedExpenseId_playerId_key" ON "SharedExpenseCharge"("sharedExpenseId", "playerId");
CREATE INDEX "SharedExpenseCharge_playerId_idx" ON "SharedExpenseCharge"("playerId");

-- AddForeignKey
ALTER TABLE "SharedExpense" ADD CONSTRAINT "SharedExpense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SharedExpenseCharge" ADD CONSTRAINT "SharedExpenseCharge_sharedExpenseId_fkey"
  FOREIGN KEY ("sharedExpenseId") REFERENCES "SharedExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedExpenseCharge" ADD CONSTRAINT "SharedExpenseCharge_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
