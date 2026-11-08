# SPDX-License-Identifier: Apache-2.0

# Fathom's PostgreSQL image: the official image with the security fixes released since it was built
# applied, gosu removed, and Fathom's first-time setup scripts, licence and notice included. gosu is
# only needed to start as root, and Fathom's database never does. Built from the repository root;
# Dockerfile.dockerignore lists the only files it reads.

FROM postgres:18.6-alpine3.24@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5

# Changing the date makes the build fetch the latest security fixes instead of reusing a cached layer.
ARG SECURITY_FIXES_DATE=unset
RUN echo "Applying security fixes available on ${SECURITY_FIXES_DATE}" \
  && apk upgrade --no-cache \
  && rm /usr/local/bin/gosu

COPY deploy/docker/postgres/init/ /docker-entrypoint-initdb.d/
COPY LICENSE NOTICE /usr/share/doc/fathom/

USER postgres

# Checks the network listener, which only starts once first-time setup has finished.
HEALTHCHECK --interval=2s --timeout=3s --retries=30 \
  CMD ["pg_isready", "--host", "127.0.0.1", "--username", "postgres", "--dbname", "fathom"]
