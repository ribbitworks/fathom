// SPDX-License-Identifier: Apache-2.0

// Shared setup for the security summary's tests: a report folder of each test's own, results files
// that pass every scan unless a test overrides one, and a summary's row for a scan.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const now = new Date("2026-11-07T12:00:00Z");

export const lockfileTarget = { Target: "pnpm-lock.yaml", Class: "lang-pkgs" };

export const cleanResults = {
  "dependencies.json": {
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
    },
    advisories: {},
  },
  "secrets-files.json": [],
  "secrets-history.json": [],
  "code.json": {
    results: [],
    errors: [],
    paths: { scanned: ["package.json"] },
  },
  "files.json": { Results: [lockfileTarget] },
  "configuration.json": { SchemaVersion: 2 },
  "container-images.json": [
    { image: "example/image:1", report: { SchemaVersion: 2, Results: [] } },
  ],
};

export let reportDir;

export function makeReportFolder() {
  reportDir = mkdtempSync(join(tmpdir(), "security-summary-"));
}

export function removeReportFolder() {
  rmSync(reportDir, { recursive: true, force: true });
}

export function writeResults(overrides = {}) {
  for (const [file, results] of Object.entries({
    ...cleanResults,
    ...overrides,
  })) {
    writeFileSync(
      join(reportDir, file),
      typeof results === "string" ? results : JSON.stringify(results),
    );
  }
}

export function rowFor(markdown, scanName) {
  return markdown
    .split("\n")
    .find((line) => line.startsWith(`| ${scanName} |`));
}
