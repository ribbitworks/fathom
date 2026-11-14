// SPDX-License-Identifier: Apache-2.0

// Vitest settings for the package shared by the browser and the server, which requires full test
// coverage.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each package keeps its own cache of compiled modules, as packages' tests start at once and
    // would otherwise race to write the one cache at the repository's root.
    fsModuleCachePath: "node_modules/.vitest-cache",
    include: ["src/**/*.test.ts"],
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
