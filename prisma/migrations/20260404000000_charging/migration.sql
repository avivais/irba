-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PAYBOX', 'BIT', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('REGISTERED', 'DROP_IN', 'ADMIN_OVERRIDE');

-- AlterTable: remove balance from Player
ALTER TABLE "Player" DROP COLUMN IF EXISTS "balance";

-- AlterTable: add charging fields to GameSession
ALTER TABLE "GameSession"
  ADD COLUMN "isCharged"            BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "alertEarlyFiredAt"    TIMESTAMP(3),
  ADD COLUMN "alertCriticalFiredAt" TIMESTAMP(3);

-- AlterTable: add method to Payment
ALTER TABLE "Payment"
  ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'BIT';

-- CreateTable: SessionCharge
CREATE TABLE "SessionCharge" (
  "id"               TEXT   NOT NULL,
  "sessionId"        TEXT   NOT NULL,
  "playerId"         TEXT   NOT NULL,
  "amount"           INTEGER NOT NULL,
  "calculatedAmount" INTEGER NOT NULL,
  "chargeType"       "ChargeType" NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SessionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChargeAuditEntry
CREATE TABLE "ChargeAuditEntry" (
  "id"              TEXT    NOT NULL,
  "sessionChargeId" TEXT    NOT NULL,
  "changedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedBy"       TEXT    NOT NULL,
  "previousAmount"  INTEGER NOT NULL,
  "newAmount"       INTEGER NOT NULL,
  "reason"          TEXT,

  CONSTRAINT "ChargeAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionCharge_sessionId_playerId_key" ON "SessionCharge"("sessionId", "playerId");
CREATE INDEX "SessionCharge_sessionId_idx" ON "SessionCharge"("sessionId");
CREATE INDEX "SessionCharge_playerId_idx" ON "SessionCharge"("playerId");
CREATE INDEX "ChargeAuditEntry_sessionChargeId_idx" ON "ChargeAuditEntry"("sessionChargeId");

-- AddForeignKey
ALTER TABLE "SessionCharge" ADD CONSTRAINT "SessionCharge_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionCharge" ADD CONSTRAINT "SessionCharge_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChargeAuditEntry" ADD CONSTRAINT "ChargeAuditEntry_sessionChargeId_fkey"
  FOREIGN KEY ("sessionChargeId") REFERENCES "SessionCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
