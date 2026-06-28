#!/bin/bash
# Runs once, on first initialization of the Postgres data volume.
# Creates the restricted application role the API connects as at runtime.
# It is NOSUPERUSER / NOBYPASSRLS so Row-Level Security actually applies to it
# (a superuser would silently bypass every policy). Table-level grants are issued
# later by the migrations, which run as the admin role.
set -e

APP_USER="${APP_DB_USER:-app}"
APP_PASSWORD="${APP_DB_PASSWORD:-app_dev_password}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_USER}') THEN
      CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}'
        NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
  END
  \$\$;

  GRANT USAGE ON SCHEMA public TO ${APP_USER};
EOSQL
