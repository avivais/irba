-- AlterEnum
ALTER TYPE "ChargeType" ADD VALUE 'FREE_ENTRY';

-- AlterTable: drop old columns, add new ones
ALTER TABLE "Challenge"
  DROP COLUMN "eligibilityMinPct",
  DROP COLUMN "metric",
  DROP COLUMN "prize",
  DROP COLUMN "roundCount",
  DROP COLUMN "title",
  ADD COLUMN "isClosed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minMatchesThreshold" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "number" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sessionCount" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "winnerId" TEXT;

-- CreateTable
CREATE TABLE "FreeEntry" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "usedInSessionId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeEntry_playerId_idx" ON "FreeEntry"("playerId");

-- CreateIndex
CREATE INDEX "FreeEntry_challengeId_idx" ON "FreeEntry"("challengeId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Challenge_number_key" ON "Challenge"("number");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeEntry" ADD CONSTRAINT "FreeEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeEntry" ADD CONSTRAINT "FreeEntry_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeEntry" ADD CONSTRAINT "FreeEntry_usedInSessionId_fkey" FOREIGN KEY ("usedInSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
