# SPDX-License-Identifier: Apache-2.0

# Fathom's proxy image: the official HAProxy image, with the security fixes released since it was
# built applied, and Fathom's configuration. It runs as HAProxy's own user, never as root.

FROM haproxy:3.2.26-alpine3.24@sha256:5893840576071e6217cd52ebdcc14f454c6f7a631056fa6f4e0f40d3cac4215b

# Changing the date makes the build fetch the latest security fixes instead of reusing a cached layer.
ARG SECURITY_FIXES_DATE=unset
USER root
RUN echo "Applying security fixes available on ${SECURITY_FIXES_DATE}" \
  && apk upgrade --no-cache
COPY haproxy.cfg /usr/local/etc/haproxy/haproxy.cfg
USER haproxy
EXPOSE 8443
# Checks the proxy accepts connections.
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD ["nc", "-z", "127.0.0.1", "8443"]
