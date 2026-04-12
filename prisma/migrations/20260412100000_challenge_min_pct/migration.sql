-- Rename Challenge.minMatchesThreshold → minMatchesPct (now a 0-100 percentage)
ALTER TABLE "Challenge" RENAME COLUMN "minMatchesThreshold" TO "minMatchesPct";

-- Reset existing values to the new default (50%)
UPDATE "Challenge" SET "minMatchesPct" = 50;

-- Rename config key and reset its value to 50 (%)
UPDATE "AppConfig" SET key = 'competition_min_matches_pct', value = '50'
  WHERE key = 'competition_min_matches_threshold';
