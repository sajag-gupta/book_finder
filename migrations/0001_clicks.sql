-- Outbound store clicks, written by functions/go/[store]/[isbn].js.
-- No IP address or user agent is stored by design.
CREATE TABLE IF NOT EXISTS clicks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  store         TEXT    NOT NULL,
  isbn13        TEXT    NOT NULL,
  affiliate     INTEGER NOT NULL DEFAULT 0 CHECK (affiliate IN (0, 1)),
  referrer_host TEXT,
  country       TEXT
);

CREATE INDEX IF NOT EXISTS idx_clicks_at ON clicks (at);
CREATE INDEX IF NOT EXISTS idx_clicks_isbn13 ON clicks (isbn13);
CREATE INDEX IF NOT EXISTS idx_clicks_store ON clicks (store);
