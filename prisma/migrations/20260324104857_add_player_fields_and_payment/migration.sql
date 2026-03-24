-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "birthdate" TIMESTAMP(3),
ADD COLUMN     "firstNameEn" TEXT,
ADD COLUMN     "firstNameHe" TEXT,
ADD COLUMN     "lastNameEn" TEXT,
ADD COLUMN     "lastNameHe" TEXT,
ADD COLUMN     "nickname" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_playerId_idx" ON "Payment"("playerId");

-- CreateIndex
CREATE INDEX "Payment_date_idx" ON "Payment"("date");

-- CreateIndex
CREATE INDEX "Player_nickname_idx" ON "Player"("nickname");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
