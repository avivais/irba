-- CreateTable
CREATE TABLE "HourlyRate" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HourlyRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HourlyRate_effectiveFrom_idx" ON "HourlyRate"("effectiveFrom");
