// SPDX-License-Identifier: Apache-2.0

// Vitest settings for the seed data generator, which requires full test coverage.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The tests start a PostgreSQL container, which takes a few seconds.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Puts back what a test spied on, such as console.log, even when the test fails part way.
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
