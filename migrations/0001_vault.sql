CREATE TABLE IF NOT EXISTS vault (
  slug TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS unlocks (
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_unlocks_expires_at ON unlocks (expires_at);
