// SPDX-License-Identifier: Apache-2.0

// Tests for summarizing the code, file, configuration, licence and container image scans: counting
// what Semgrep and Trivy find by severity, and when each scan did not complete.

import assert from "node:assert/strict";
import {} from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { summarize } from "./security-summary.mjs";
import {
  lockfileTarget,
  makeReportFolder,
  now,
  removeReportFolder,
  reportDir,
  rowFor,
  writeResults,
} from "./test-security-summary.mjs";

describe("security summary of the code, file and image scans", () => {
  beforeEach(makeReportFolder);
  afterEach(removeReportFolder);

  it("does not complete when Semgrep scanned no files", () => {
    writeResults({
      "code.json": { results: [], errors: [], paths: { scanned: [] } },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(rowFor(markdown, "Code security flaws"), /Did not complete/);
  });

  it("does not complete when Semgrep reports an error-level error", () => {
    writeResults({
      "code.json": {
        results: [],
        errors: [{ level: "error" }],
        paths: { scanned: ["package.json"] },
      },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(rowFor(markdown, "Code security flaws"), /Did not complete/);
  });

  const span = (first, firstCol, last, lastCol) => ({
    start: { line: first, col: firstCol },
    end: { line: last, col: lastCol },
  });
  const partial = (path, ...spans) => ({
    level: "warn",
    type: ["PartialParsing", spans],
    path,
  });
  const scanWith = (errors) => {
    writeResults({
      "code.json": {
        results: [],
        errors,
        paths: { scanned: ["scripts/example.sh"] },
      },
    });
    return summarize(reportDir);
  };

  it("does not complete when Semgrep left any part of a file unscanned, and says what", () => {
    for (const [error, gap] of [
      [
        { level: "warn", type: "Syntax error", path: "scripts/example.sh" },
        /Semgrep could not parse scripts\/example\.sh, so it was not scanned\./,
      ],
      [
        { level: "warn", type: "Lexical error", path: "a.sh" },
        /could not parse a\.sh/,
      ],
      [
        { level: "warn", type: "Timeout", path: "big.test.ts" },
        /Semgrep did not finish big\.test\.ts \(Timeout\), so it was not fully scanned\./,
      ],
      [
        { level: "warn", type: "AST builder error", path: "b.ts" },
        /did not finish b\.ts \(AST builder error\)/,
      ],
      [
        { level: "warn", type: "A kind not seen before", path: "c.ts" },
        /did not finish c\.ts \(A kind not seen before\)/,
      ],
      [
        { level: "error" },
        /did not finish an unnamed file \(an unknown error\)/,
      ],
      [
        partial("scripts/example.sh", span(20, 1, 56, 6)),
        /Semgrep skipped lines 20 to 56 of scripts\/example\.sh, so they were not scanned\./,
      ],
      [
        partial("min.js", span(1, 1, 1, 50000)),
        /Semgrep skipped part of line 1 of min\.js, so it was not scanned\./,
      ],
      [partial("d.ts", null), /Semgrep skipped part of d\.ts/],
      [
        partial("e.ts", { start: {}, end: {} }),
        /Semgrep skipped part of e\.ts/,
      ],
      [
        { level: "warn", type: ["PartialParsing", "not a list"], path: "f.ts" },
        /did not finish f\.ts \(PartialParsing\)/,
      ],
    ]) {
      const { failed, markdown } = scanWith([error]);
      assert.equal(failed, true, String(gap));
      assert.match(rowFor(markdown, "Code security flaws"), /Did not complete/);
      assert.match(markdown, gap);
    }
  });

  it("does not complete when Semgrep's results cannot be read, and says why", () => {
    for (const [results, gap] of [
      [{ errors: [], paths: { scanned: ["a.ts"] } }, /no list of results/],
      [
        { results: [], errors: {}, paths: { scanned: ["a.ts"] } },
        /list of errors could not be read/,
      ],
      [
        { results: [], errors: [], paths: { scanned: [] } },
        /Semgrep scanned no files\./,
      ],
    ]) {
      writeResults({ "code.json": results });
      const { failed, markdown } = summarize(reportDir);
      assert.equal(failed, true, String(gap));
      assert.match(markdown, gap);
    }
  });

  it("completes when Semgrep skipped only short fragments within lines, naming each gap once", () => {
    const { failed, markdown } = scanWith([
      partial(
        "src/example.ts",
        span(301, 33, 301, 38),
        span(303, 22, 303, 27),
        span(303, 22, 303, 27),
      ),
    ]);
    assert.equal(failed, false);
    assert.doesNotMatch(markdown, /not scanned/);
    assert.match(markdown, /Semgrep reported 1 errors/);

    const repeated = scanWith([
      partial("g.sh", span(2, 1, 9, 1), span(2, 1, 9, 1)),
    ]).markdown;
    assert.equal(repeated.match(/skipped lines 2 to 9 of g\.sh/g)?.length, 1);
  });

  it("maps Semgrep severities and notes lesser Semgrep errors", () => {
    writeResults({
      "code.json": {
        results: [
          { extra: { severity: "WARNING" } },
          { extra: { severity: "INFO" } },
        ],
        errors: [partial("src/example.ts", span(4, 1, 4, 6))],
        paths: { scanned: ["package.json"] },
      },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, false);
    assert.match(
      rowFor(markdown, "Code security flaws"),
      /\| Pass \| 0 \| 0 \| 1 \| 1 \|$/,
    );
    assert.match(markdown, /Semgrep reported 1 errors/);
  });

  it("does not complete when Trivy did not read the lockfile", () => {
    writeResults({
      "files.json": { Results: [{ Target: "Dockerfile", Class: "config" }] },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities and licences"),
      /Did not complete/,
    );
  });

  it("does not complete when Trivy returns no results", () => {
    writeResults({ "files.json": {} });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities and licences"),
      /Did not complete/,
    );
  });

  it("counts vulnerabilities across every scanned container image, warns about those with no fix, and names the images", () => {
    writeResults({
      "container-images.json": [
        {
          image: "example/one:1",
          report: {
            SchemaVersion: 2,
            Results: [{ Vulnerabilities: [{ Severity: "CRITICAL" }] }],
          },
        },
        {
          image: "example/two:1",
          report: {
            SchemaVersion: 2,
            Results: [
              {
                Vulnerabilities: [
                  { Severity: "LOW", Status: "affected", FixedVersion: "" },
                ],
              },
            ],
          },
        },
      ],
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, false);
    assert.match(
      rowFor(markdown, "Container images"),
      /\| Pass \| 1 \| 0 \| 0 \| 1 \|$/,
    );
    assert.match(markdown, /2 vulnerabilities have no fix released yet/);
    assert.match(markdown, /Images scanned: example\/one:1, example\/two:1\./);
  });

  it("fails on an overdue fix in a container image's operating system packages", () => {
    writeResults({
      "container-images.json": [
        {
          image: "example/image:1",
          report: {
            SchemaVersion: 2,
            Results: [
              {
                Type: "debian",
                Vulnerabilities: [
                  {
                    VulnerabilityID: "CVE-2026-1",
                    PkgName: "zlib1g",
                    InstalledVersion: "1:1.3-3",
                    FixedVersion: "1:1.3-4",
                    Status: "fixed",
                    Severity: "CRITICAL",
                  },
                ],
              },
            ],
          },
        },
      ],
      "fix-dates.json": {
        "debian:zlib1g@1:1.3-4": {
          released: "2026-10-01T00:00:00Z",
          source: "Debian snapshot archive",
        },
      },
    });
    const { failed, markdown } = summarize(reportDir, now);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Container images"),
      /\| Fail \| 1 \| 0 \| 0 \| 0 \|$/,
    );
    assert.match(
      markdown,
      /\| 2026-10-01 \| Debian snapshot archive \| 2026-10-15 \(overdue\) \|/,
    );
  });

  it("counts a fix first seen from the time given as having no known release date", () => {
    const sightedOn = (released) => ({
      "container-images.json": [
        {
          image: "example/image:1",
          report: {
            SchemaVersion: 2,
            Results: [
              {
                Type: "alpine",
                Vulnerabilities: [
                  {
                    VulnerabilityID: "CVE-2026-2",
                    PkgName: "busybox",
                    InstalledVersion: "1.37.0-r1",
                    FixedVersion: "1.37.0-r2",
                    Status: "fixed",
                    Severity: "LOW",
                  },
                ],
              },
            ],
          },
        },
      ],
      "fix-dates.json": {
        "alpine:busybox@1.37.0-r2": { released, source: "first seen" },
      },
    });
    const options = {
      files: ["container-images.json"],
      firstSeenUnknownFrom: new Date("2026-11-07T11:00:00Z"),
    };
    writeResults(sightedOn("2026-11-07T11:30:00Z"));
    const fresh = summarize(reportDir, now, options);
    assert.equal(fresh.failed, true);
    assert.match(fresh.markdown, /Unknown release date \(overdue\)/);
    writeResults(sightedOn("2026-11-01T00:00:00Z"));
    assert.equal(summarize(reportDir, now, options).failed, false);
    writeResults(sightedOn("2026-11-07T11:30:00Z"));
    assert.equal(summarize(reportDir, now).failed, false);
  });

  it("counts every secret built into a container image as high", () => {
    writeResults({
      "container-images.json": [
        {
          image: "example/image:1",
          report: {
            SchemaVersion: 2,
            Results: [
              { Secrets: [{ Severity: "LOW" }, { Severity: "MEDIUM" }] },
            ],
          },
        },
      ],
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Container images"),
      /\| Fail \| 0 \| 2 \| 0 \| 0 \|$/,
    );
  });

  it("does not complete the container image scan when no image was scanned or a scan failed", () => {
    for (const results of [[], [{ image: "example/image:1", report: null }]]) {
      writeResults({ "container-images.json": results });
      const { failed, markdown } = summarize(reportDir);
      assert.equal(failed, true);
      assert.match(rowFor(markdown, "Container images"), /Did not complete/);
    }
  });

  it("counts Trivy misconfigurations in the project's configuration", () => {
    writeResults({
      "configuration.json": {
        SchemaVersion: 2,
        Results: [
          {
            Target: "Dockerfile",
            Misconfigurations: [{ Severity: "HIGH" }, { Severity: "LOW" }],
          },
        ],
      },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Configuration"),
      /\| Fail \| 0 \| 1 \| 0 \| 1 \|$/,
    );
  });

  it("passes the configuration scan when there are no configuration files to check", () => {
    writeResults({ "configuration.json": { SchemaVersion: 2 } });
    const { markdown } = summarize(reportDir);
    assert.match(rowFor(markdown, "Configuration"), /\| Pass \|/);
  });

  it("does not complete the configuration scan without a Trivy report", () => {
    writeResults({ "configuration.json": { message: "unexpected" } });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(rowFor(markdown, "Configuration"), /Did not complete/);
  });

  it("ignores permissive licences and counts unclassified ones and unknown severities as medium", () => {
    writeResults({
      "files.json": {
        Results: [
          {
            ...lockfileTarget,
            Vulnerabilities: [{ Severity: "UNKNOWN" }],
            Licenses: [{ Severity: "LOW" }, { Severity: "UNKNOWN" }],
          },
        ],
      },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, false);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities and licences"),
      /\| Pass \| 0 \| 0 \| 2 \| 0 \|$/,
    );
  });
});
