// SPDX-License-Identifier: Apache-2.0

// Vitest settings for the database package, which requires full test coverage.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each package keeps its own cache of compiled modules, as packages' tests start at once and
    // would otherwise race to write the one cache at the repository's root.
    fsModuleCachePath: "node_modules/.vitest-cache",
    include: ["src/**/*.test.ts"],
    // One PostgreSQL server for the run, which every test file copies a database from.
    globalSetup: ["./test-databases.ts"],
    // The tests run against a real PostgreSQL server, which is slower under load.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
