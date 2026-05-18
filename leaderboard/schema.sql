-- Football Conquest leaderboard — D1 schema
-- Apply with: wrangler d1 execute fc-leaderboard --file=./schema.sql --remote
--
-- One row per finished campaign (Victory or Eliminated). Abandoned runs
-- (player started a new game without finishing) are NOT submitted.

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  username TEXT NOT NULL,
  hero_name TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('victory','eliminated')),
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  gf INTEGER NOT NULL,
  ga INTEGER NOT NULL,
  turns INTEGER NOT NULL,
  territories_owned INTEGER NOT NULL,
  eliminated_by TEXT,
  -- Plausibility: server-recorded receipt time + client-claimed campaign duration.
  client_dt_ms INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL,
  -- Hashed IP for rate-limiting; never expose this in API responses.
  ip_hash TEXT NOT NULL,
  -- Goal difference is computed at write time for cheap sorting by GD.
  gd INTEGER GENERATED ALWAYS AS (gf - ga) VIRTUAL
);

-- Sort by Most Total Wins (overall ranking)
CREATE INDEX IF NOT EXISTS idx_runs_wins ON runs(wins DESC, gd DESC);
-- Sort by Fastest Victory (lowest turn count among Victories only)
CREATE INDEX IF NOT EXISTS idx_runs_fastest_victory
  ON runs(turns ASC, gd DESC) WHERE result='victory';
-- Sort by Best Goal Difference
CREATE INDEX IF NOT EXISTS idx_runs_gd ON runs(gd DESC, wins DESC);
-- Sort by Most Goals Scored
CREATE INDEX IF NOT EXISTS idx_runs_gf ON runs(gf DESC, gd DESC);
-- Lookups by device for "your global runs" view and rate-limiting.
CREATE INDEX IF NOT EXISTS idx_runs_device ON runs(device_id, submitted_at DESC);
-- Per-country leaderboards (Phase 2 — uses this index when filtering by hero).
CREATE INDEX IF NOT EXISTS idx_runs_hero ON runs(hero_name, wins DESC);
-- Recent submissions firehose (for moderation / new-run feed).
CREATE INDEX IF NOT EXISTS idx_runs_submitted ON runs(submitted_at DESC);
