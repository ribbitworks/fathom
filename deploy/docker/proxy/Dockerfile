# SPDX-License-Identifier: Apache-2.0

# Fathom's proxy image: the official HAProxy image, with the security fixes released since it was
# built applied, Fathom's configuration, and Fathom's licence and notice, as the Apache License asks.
# It runs as HAProxy's own user, never as root. Built from the repository root;
# Dockerfile.dockerignore lists the only files it reads.

FROM haproxy:3.4.8-alpine3.24@sha256:8aa6458a9d22a8364a2d2ee9ce93de0cc4a2789e3cf63f0b44adc972863724d7

# Changing the date makes the build fetch the latest security fixes instead of reusing a cached layer.
ARG SECURITY_FIXES_DATE=unset
USER root
RUN echo "Applying security fixes available on ${SECURITY_FIXES_DATE}" \
  && apk upgrade --no-cache
COPY deploy/docker/proxy/haproxy.cfg /usr/local/etc/haproxy/haproxy.cfg
COPY LICENSE NOTICE /usr/share/doc/fathom/
USER haproxy
EXPOSE 8443
# Checks the proxy accepts connections.
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD ["nc", "-z", "127.0.0.1", "8443"]
