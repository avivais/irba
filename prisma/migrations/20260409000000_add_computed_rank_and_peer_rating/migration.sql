-- AlterTable: add computedRank to Player
ALTER TABLE "Player" ADD COLUMN "computedRank" DOUBLE PRECISION;

-- CreateTable: PeerRatingSession
CREATE TABLE "PeerRatingSession" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openedBy" TEXT NOT NULL,

    CONSTRAINT "PeerRatingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PeerRating
CREATE TABLE "PeerRating" (
    "id" TEXT NOT NULL,
    "ratingSessionId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "ratedPlayerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeerRatingSession_year_key" ON "PeerRatingSession"("year");

-- CreateIndex
CREATE INDEX "PeerRating_ratingSessionId_idx" ON "PeerRating"("ratingSessionId");

-- CreateIndex
CREATE INDEX "PeerRating_raterId_idx" ON "PeerRating"("raterId");

-- CreateIndex
CREATE UNIQUE INDEX "PeerRating_ratingSessionId_raterId_ratedPlayerId_key" ON "PeerRating"("ratingSessionId", "raterId", "ratedPlayerId");

-- AddForeignKey
ALTER TABLE "PeerRating" ADD CONSTRAINT "PeerRating_ratingSessionId_fkey" FOREIGN KEY ("ratingSessionId") REFERENCES "PeerRatingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
