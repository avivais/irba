-- CreateTable
CREATE TABLE "YearWeight" (
    "year" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "YearWeight_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "PlayerYearAggregate" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerYearAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAdjustment" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerYearAggregate_playerId_idx" ON "PlayerYearAggregate"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerYearAggregate_playerId_year_key" ON "PlayerYearAggregate"("playerId", "year");

-- CreateIndex
CREATE INDEX "PlayerAdjustment_playerId_idx" ON "PlayerAdjustment"("playerId");

-- AddForeignKey
ALTER TABLE "PlayerYearAggregate" ADD CONSTRAINT "PlayerYearAggregate_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAdjustment" ADD CONSTRAINT "PlayerAdjustment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
