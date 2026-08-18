-- Football Conquest — Random Imperialism global run feed (v250)
-- Apply with:
--   wrangler d1 execute fc-leaderboard --file=./leaderboard/migration-2026-08-ri.sql --remote
--
-- One row per FINISHED Random Imperialism sim (a nation conquered the world).
-- RI is AI-driven, so this is a shared record of who won — NOT a competitive
-- player board. Submitted anonymously (device_id only; username optional for
-- attribution). Kept in its own table because the shape has nothing in common
-- with the World Conquest `runs` table (no hero, wins, losses or full-map check).

CREATE TABLE IF NOT EXISTS ri_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id    TEXT NOT NULL,
  username     TEXT,                       -- optional display name for attribution
  champion     TEXT NOT NULL,              -- last nation standing (canonical English name)
  turns        INTEGER NOT NULL,           -- turn count at victory (~211 for a full run)
  top5         TEXT NOT NULL,              -- JSON array: champion + up to 4 runners-up
  submitted_at TEXT NOT NULL,              -- ISO-8601 UTC receipt time
  ip_hash      TEXT NOT NULL               -- hashed IP for rate-limiting; never returned
);

-- Recent-runs feed (default view) + rate-limit window scans.
CREATE INDEX IF NOT EXISTS idx_ri_submitted ON ri_runs(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ri_device    ON ri_runs(device_id, submitted_at DESC);
-- "Most-winning nations" aggregate view.
CREATE INDEX IF NOT EXISTS idx_ri_champion  ON ri_runs(champion);
