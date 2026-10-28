#!/usr/bin/env bash
# Creates Fathom's database roles and schemas with least privilege. Runs once, as the PostgreSQL
# superuser, when the database is first created. Role passwords are read from container secrets.
set -euo pipefail

psql --no-psqlrc --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set database="$POSTGRES_DB" <<'SQL'
-- Statements are never written to the server log, even when they fail, because some hold passwords.
SET log_min_error_statement = panic;

-- Passwords are read from files by psql itself, so they never appear on a command line.
\set migrator_password `cat /run/secrets/fathom_migrator_password`
\set app_password `cat /run/secrets/fathom_app_password`

-- Neither role can bypass security, create databases or roles, or inherit other roles' rights.
CREATE ROLE fathom_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
  PASSWORD :'migrator_password';
CREATE ROLE fathom_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
  PASSWORD :'app_password';

-- Only Fathom's roles may connect to Fathom's database, and neither may connect to the others.
REVOKE ALL ON DATABASE :"database" FROM PUBLIC;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database" TO fathom_migrator, fathom_app;

-- The migration role changes the schema. The migration runner needs to create schemas, so it may,
-- but only in Fathom's database.
GRANT CREATE ON DATABASE :"database" TO fathom_migrator;

-- Nobody may create objects in the public schema.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Large objects would let a role store data outside Fathom's schema, so nobody may use them.
DO $$
DECLARE
  large_object_function regprocedure;
BEGIN
  FOR large_object_function IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'pg_catalog'::regnamespace
      AND (p.proname LIKE 'lo\_%' OR p.proname IN ('loread', 'lowrite'))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', large_object_function);
  END LOOP;
END
$$;

-- Fathom's schema belongs to the migration role. The application role can use it, and can read and
-- write data in tables the migration role creates, but cannot change the schema.
CREATE SCHEMA fathom AUTHORIZATION fathom_migrator;
GRANT USAGE ON SCHEMA fathom TO fathom_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fathom_migrator IN SCHEMA fathom
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fathom_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fathom_migrator IN SCHEMA fathom
  GRANT USAGE, SELECT ON SEQUENCES TO fathom_app;
-- Functions the migration role creates are not callable by everyone; access is granted explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE fathom_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- The record of applied migrations has its own schema, which the application role cannot use.
CREATE SCHEMA fathom_migrations AUTHORIZATION fathom_migrator;

ALTER ROLE fathom_migrator SET search_path = fathom;
ALTER ROLE fathom_app SET search_path = fathom;
SQL
