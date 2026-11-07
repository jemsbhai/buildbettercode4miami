-- Neon integration owners may bypass RLS. Runtime always assumes this restricted role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tidepath_public_runtime') THEN
    CREATE ROLE tidepath_public_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tidepath_public_runtime' AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolcanlogin)) THEN
    RAISE EXCEPTION 'The Tidepath runtime role has unsafe privileges';
  END IF;
  EXECUTE format('GRANT tidepath_public_runtime TO %I', current_user);
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO tidepath_public_runtime', current_schema());
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON tidepath_accounts,tidepath_memberships,tidepath_workspaces,tidepath_usage,tidepath_sessions TO tidepath_public_runtime;
