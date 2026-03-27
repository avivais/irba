-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION,
ADD COLUMN     "locationName" TEXT;
