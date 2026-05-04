ALTER TABLE "GameSession"
  ADD COLUMN "cancelledAt"        TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;
