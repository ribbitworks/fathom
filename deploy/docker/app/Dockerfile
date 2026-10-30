# SPDX-License-Identifier: Apache-2.0

# Fathom's application image: the server, the built front end, and the migration runner, on a
# distroless Node.js image with no shell or package manager, running as a user other than root.
# Packages are installed and the front end is built on the build machine's own processor, since the
# result is the same JavaScript for every processor and none of the runtime packages is native.
# Built from the repository root; Dockerfile.dockerignore lists the only files it reads.

FROM --platform=$BUILDPLATFORM node:24.22.1-trixie-slim@sha256:89c5244bc22a9bc3287d89ebc7e49b9cb5bb84cd40e6175ac3421d5a9f68b95a AS base
WORKDIR /app
# The pnpm version pinned in package.json, without running any install scripts.
COPY package.json ./
RUN npm install --global --ignore-scripts \
  "pnpm@$(node -p "require('./package.json').packageManager.replace(/^pnpm@/, '').split('+')[0]")"
# Every workspace package's manifest, so the lockfile can be checked as a whole.
COPY pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/test-utils/package.json packages/test-utils/

FROM base AS web
RUN pnpm install --frozen-lockfile --filter @fathom/web...
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
COPY apps/web apps/web
RUN pnpm --filter @fathom/web build

# Production packages only. Node.js runs TypeScript only outside node_modules, so the workspace
# packages stay in their own folders, linked from node_modules as in development.
FROM base AS server
RUN pnpm install --frozen-lockfile --prod --filter @fathom/server...
COPY packages/shared/src packages/shared/src
COPY packages/db/src packages/db/src
COPY packages/db/migrations packages/db/migrations
COPY apps/server/src apps/server/src
RUN find . -path ./node_modules -prune -o -name '*.test.ts' -exec rm {} +
# Packages are installed for the build machine's processor, so a native package would not run.
RUN if find -L node_modules -name '*.node' | grep -q .; then \
    echo "error: a runtime package has native code, which this image cannot build" >&2; exit 1; \
  fi
# Development tools, which carry native binaries, must never reach the runtime image.
RUN if ls node_modules/.pnpm | grep -E '^(esbuild|@esbuild|drizzle-kit|vite|vitest|typescript)@'; then \
    echo "error: development tools were installed as runtime packages" >&2; exit 1; \
  fi

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:cb606325b7ec4af55462cb0b424a53b452a5b4a894ffe841fcf1048d216fb9f8
WORKDIR /app
COPY --from=server /app/package.json ./
COPY --from=server /app/node_modules node_modules
COPY --from=server /app/packages packages
COPY --from=server /app/apps/server apps/server
COPY --from=web /app/apps/web/dist web
ENV NODE_ENV=production
USER nonroot
EXPOSE 8443
# Checks the server accepts connections; it has no shell or HTTP client to do more.
HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
  CMD ["/nodejs/bin/node", "-e", "require('node:net').connect(8443, '127.0.0.1').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"]
CMD ["apps/server/src/main.ts"]
