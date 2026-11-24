// SPDX-License-Identifier: Apache-2.0

// Settings for the UI tests, which 'pnpm test:ui' runs in a real browser against this copy's
// development server.

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.FATHOM_UI_URL;
if (baseURL === undefined || baseURL === "")
  throw new Error("Run the UI tests with 'pnpm test:ui'");

export default defineConfig({
  testDir: "e2e",
  outputDir: "../../.tmp/ui-tests",
  // The tests share one development database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Signs each account in once, untraced, since a trace would hold the password it sends.
    { name: "accounts", testMatch: /\.setup\.ts$/, use: { trace: "off" } },
    {
      name: "chromium",
      dependencies: ["accounts"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
