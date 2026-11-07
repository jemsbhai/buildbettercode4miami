CREATE TABLE IF NOT EXISTS tidepath_sessions (
  token_hash text PRIMARY KEY,
  google_subject text NOT NULL REFERENCES tidepath_accounts(google_subject) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tidepath_sessions_expiry ON tidepath_sessions(expires_at);
