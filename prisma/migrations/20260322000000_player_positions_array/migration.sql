-- Migrate Player.position (single nullable enum) to Player.positions (array of enums)

-- Step 1: Add the new positions array column
ALTER TABLE "Player" ADD COLUMN "positions" "Position"[] NOT NULL DEFAULT '{}';

-- Step 2: Migrate existing data — copy non-null position into the array
UPDATE "Player" SET "positions" = ARRAY["position"::"Position"] WHERE "position" IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE "Player" DROP COLUMN "position";
