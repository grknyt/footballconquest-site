-- v203 migration: add difficulty to an EXISTING fc-leaderboard D1 database.
-- Existing rows were all played at the historical 3-loss rule, so they backfill
-- to 'medium' via the column DEFAULT.
--
-- Apply with:
--   wrangler d1 execute fc-leaderboard --file=./leaderboard/migration-2026-08-difficulty.sql --remote
--
-- (Fresh databases created from schema.sql already include this column, so this
--  migration is only for the live DB that predates v203.)

ALTER TABLE runs ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_runs_difficulty ON runs(difficulty, wins DESC, gd DESC);
