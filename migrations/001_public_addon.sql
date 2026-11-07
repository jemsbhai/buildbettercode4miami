-- This schema is independent of the hackathon's file-backed state.
CREATE TABLE IF NOT EXISTS tidepath_accounts (
  google_subject text PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tidepath_memberships (
  organization_id uuid NOT NULL REFERENCES tidepath_accounts(organization_id) ON DELETE CASCADE,
  google_subject text NOT NULL REFERENCES tidepath_accounts(google_subject) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner')),
  PRIMARY KEY (organization_id, google_subject)
);
CREATE TABLE IF NOT EXISTS tidepath_workspaces (
  organization_id uuid NOT NULL REFERENCES tidepath_accounts(organization_id) ON DELETE CASCADE,
  workbook_id text NOT NULL,
  state jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  PRIMARY KEY (organization_id, workbook_id)
);
CREATE INDEX IF NOT EXISTS tidepath_workspaces_expiry ON tidepath_workspaces(expires_at);
ALTER TABLE tidepath_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE tidepath_workspaces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tidepath_private_workspace ON tidepath_workspaces;
CREATE POLICY tidepath_private_workspace ON tidepath_workspaces
  USING (organization_id::text = current_setting('tidepath.organization_id', true))
  WITH CHECK (organization_id::text = current_setting('tidepath.organization_id', true));
-- Non-content abuse counters persist after account deletion until their bounded expiry.
CREATE TABLE IF NOT EXISTS tidepath_usage (
  subject_hash text NOT NULL,
  bucket text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('command', 'generation')),
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (subject_hash, bucket, kind)
);
CREATE INDEX IF NOT EXISTS tidepath_usage_expiry ON tidepath_usage(expires_at);
