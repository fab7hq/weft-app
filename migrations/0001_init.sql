-- account.md §6. Every query goes through a primary key or one of the two
-- indexes: D1 counts rows scanned.
CREATE TABLE users (
  id          TEXT PRIMARY KEY,         -- random, never shown
  github_id   INTEGER NOT NULL UNIQUE,
  login       TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE TABLE sessions (
  hash        TEXT PRIMARY KEY,         -- sha256 of the cookie
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  -- Assertions this minute (account.md §8): one write each.
  minute      INTEGER NOT NULL DEFAULT 0,
  asserted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE machines (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  address     TEXT,                     -- not indexed: a write costs one row
  address_at  INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX machines_user ON machines(user_id);
CREATE INDEX sessions_expires ON sessions(expires_at);
