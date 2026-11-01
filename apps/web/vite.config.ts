// SPDX-License-Identifier: Apache-2.0

// Vite and Vitest settings for the front end. In development mode, Vite serves the page over HTTPS
// with the development certificate and forwards API requests to the server, so the browser sees one
// origin. Tests run in a simulated browser and require full test coverage.

import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const environment = process.env;
const folder = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// 'pnpm dev' sets the certificate and the server's port; tests and builds do not need them.
function https() {
  const certFile = environment.FATHOM_TLS_CERT_FILE;
  const keyFile = environment.FATHOM_TLS_KEY_FILE;
  if (certFile === undefined || keyFile === undefined) return {};
  // The paths come from the development scripts, not from users of the application.
  return {
    https: {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      cert: readFileSync(certFile),
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      key: readFileSync(keyFile),
    },
  };
}

// Dates, names, and counts are shown in the computer's language, so tests fix one. Each test process reads it
// as it starts, so it is set here, before Vitest starts them.
if (environment.VITEST !== undefined) environment.LC_ALL = "en_US.UTF-8";

export default defineConfig({
  plugins: [react()],
  server: {
    ...https(),
    port: Number(environment.FATHOM_DEV_PORT ?? "8443"),
    strictPort: true,
    open: environment.FATHOM_DEV_OPEN !== "false",
    // Vite would otherwise serve any file in the workspace, including the private .dev/ and private/
    // folders, so it may serve only the front end, the shared package, and installed packages.
    fs: {
      strict: true,
      allow: [
        folder("."),
        folder("../../packages/shared"),
        folder("../../node_modules"),
      ],
    },
    proxy: {
      // The server's certificate is checked; 'pnpm dev' trusts mkcert's certificate authority.
      "/api": {
        target: `https://127.0.0.1:${environment.FATHOM_PORT ?? "8444"}`,
        secure: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // One bundle, fetched once over the company network and then cached, suits a small internal tool
    // better than splitting it; Mantine and the router make it larger than Vite's default limit.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: "jsdom",
    // Dates and times are shown in the computer's time zone, so tests fix one.
    env: { TZ: "UTC" },
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // main.tsx only starts the page in the browser, and test-setup.ts and test-support.tsx only
      // serve the tests; the parts main.tsx puts together are tested.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/main.tsx",
        "src/test-setup.ts",
        "src/test-support.tsx",
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
