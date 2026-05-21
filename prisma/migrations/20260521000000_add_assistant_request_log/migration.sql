-- CreateTable
CREATE TABLE "AssistantRequestLog" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "actorPhone" TEXT NOT NULL,
    "groupJid" TEXT NOT NULL,
    "resultCode" TEXT NOT NULL,
    "resultSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantRequestLog_idempotencyKey_key" ON "AssistantRequestLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AssistantRequestLog_createdAt_idx" ON "AssistantRequestLog"("createdAt");

-- Seed assistant API config defaults.
INSERT INTO "AppConfig" ("key", "value", "updatedAt")
VALUES
  ('assistant_allowed_groups', '', NOW()),
  ('assistant_log_retention_days', '7', NOW())
ON CONFLICT ("key") DO NOTHING;
