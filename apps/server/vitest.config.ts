// SPDX-License-Identifier: Apache-2.0

// Vitest settings for the server, which requires full test coverage.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The tests start a PostgreSQL container, which takes a few seconds.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // main.ts only runs as the server process; the serve command it calls is tested. test-app.ts
      // is a helper for tests.
      exclude: ["src/**/*.test.ts", "src/test-app.ts", "src/main.ts"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
