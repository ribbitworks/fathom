#!/usr/bin/env bash
# Refuses superuser logins over the network, including replication connections. Maintenance uses the
# local socket inside the container, which also requires the password. Takes effect when the server
# restarts after first-time setup.
set -euo pipefail

hba="$PGDATA/pg_hba.conf"
{
  printf 'host all postgres all reject\n'
  printf 'host replication postgres all reject\n'
  cat "$hba"
} >"$hba.new"
mv "$hba.new" "$hba"
