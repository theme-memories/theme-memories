CREATE TABLE IF NOT EXISTS unlock (
  userid     TEXT    NOT NULL,
  slug       TEXT    NOT NULL,
  authedTime INTEGER NOT NULL,
  expireTime INTEGER NOT NULL,
  PRIMARY KEY (userid, slug)
);

CREATE INDEX IF NOT EXISTS unlock_expire_idx ON unlock (expireTime);
