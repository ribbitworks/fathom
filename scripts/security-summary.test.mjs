// SPDX-License-Identifier: Apache-2.0

// Tests for summarizing security reports: counting findings by severity for each tool, failing when
// a vulnerability's fix is overdue, another scan finds a critical or high issue, or a scan does not
// complete, and warning about vulnerabilities with no fix released.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { summarize } from "./security-summary.mjs";

const now = new Date("2026-11-07T12:00:00Z");

const summaryScript = fileURLToPath(
  new URL("./security-summary.mjs", import.meta.url),
);

const lockfileTarget = { Target: "pnpm-lock.yaml", Class: "lang-pkgs" };

const cleanResults = {
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

let reportDir;

function writeResults(overrides = {}) {
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

function rowFor(markdown, scanName) {
  return markdown
    .split("\n")
    .find((line) => line.startsWith(`| ${scanName} |`));
}

function runSummaryScript(...args) {
  return spawnSync(process.execPath, [summaryScript, ...args], {
    encoding: "utf8",
  });
}

describe("security summary", () => {
  beforeEach(() => {
    reportDir = mkdtempSync(join(tmpdir(), "security-summary-"));
  });

  afterEach(() => {
    rmSync(reportDir, { recursive: true, force: true });
  });

  it("passes when every scan completes with no critical or high findings", () => {
    writeResults();
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, false);
    assert.match(markdown, /\*\*Result:\*\* Pass/);
  });

  const advisory = (severity, patched, ...versions) => ({
    github_advisory_id: `GHSA-${severity}`,
    module_name: "example",
    severity,
    patched_versions: patched,
    findings: versions.map((version) => ({ version })),
  });
  const audit = (...advisories) => ({
    "dependencies.json": {
      metadata: { vulnerabilities: {} },
      advisories: Object.fromEntries(advisories.map((a, i) => [i, a])),
    },
  });
  const released = (key, date) => ({
    "fix-dates.json": { [key]: { released: date, source: "npm registry" } },
  });

  it("warns about dependency vulnerabilities with no fix released, whatever their severity", () => {
    writeResults(
      audit(
        advisory("critical", "<0.0.0", "1.0.0"),
        advisory("info", "", "1.0.0"),
      ),
    );
    const { failed, markdown } = summarize(reportDir, now);
    assert.equal(failed, false);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /\| Pass \| 1 \| 0 \| 0 \| 1 \|$/,
    );
    assert.match(
      markdown,
      /2 vulnerabilities have no fix released yet, and are warnings until one is\./,
    );
    assert.match(
      markdown,
      /Critical or high, with no fix released: GHSA-critical in example\./,
    );
  });

  it("fails once a fix is overdue, counted from the fix's release by severity", () => {
    for (const [severity, releasedOn, overdue] of [
      ["critical", "2026-10-23T00:00:00Z", true],
      ["critical", "2026-10-24T00:00:00Z", false],
      ["high", "2026-09-07T00:00:00Z", true],
      ["high", "2026-09-08T00:00:00Z", false],
      ["moderate", "2026-05-10T00:00:00Z", true],
      ["moderate", "2026-05-11T00:00:00Z", false],
      ["low", "2020-01-01T00:00:00Z", false],
    ]) {
      writeResults({
        ...audit(advisory(severity, ">=2.0.0", "1.0.0")),
        ...released("npm:example@2.0.0", releasedOn),
      });
      const { failed, markdown } = summarize(reportDir, now);
      assert.equal(failed, overdue, `${severity} ${releasedOn}`);
      assert.match(
        rowFor(markdown, "Dependency vulnerabilities"),
        overdue ? /\| Fail \|/ : /\| Pass \|/,
      );
      assert.equal(markdown.includes("(overdue)"), overdue);
    }
  });

  it("lists each vulnerability with a fix, its release and due date, once across scans", () => {
    writeResults({
      ...audit(advisory("high", ">=2.0.0", "1.0.0", "1.5.0")),
      "files.json": {
        Results: [
          {
            ...lockfileTarget,
            Type: "pnpm",
            Vulnerabilities: [
              {
                VulnerabilityID: "GHSA-high",
                PkgName: "example",
                InstalledVersion: "1.0.0",
                FixedVersion: "2.0.0",
                Status: "fixed",
                Severity: "HIGH",
              },
            ],
          },
        ],
      },
      ...released("npm:example@2.0.0", "2026-11-01T10:00:00Z"),
    });
    const { failed, markdown } = summarize(reportDir, now);
    assert.equal(failed, false);
    assert.match(
      markdown,
      /\| GHSA-high \| example 1\.0\.0 \| high \| 2\.0\.0 \| 2026-11-01 \| npm registry \| 2026-12-31 \|/,
    );
    assert.match(markdown, /\| GHSA-high \| example 1\.5\.0 \|/);
    assert.equal(
      markdown.match(/\| GHSA-high \| example 1\.0\.0 \|/g)?.length,
      1,
    );
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities and licences"),
      /\| Pass \| 0 \| 1 \| 0 \| 0 \|$/,
    );
  });

  it("shows a low vulnerability's fix as due at the next planned update", () => {
    writeResults({
      ...audit(advisory("low", ">=2.0.0", "1.0.0")),
      ...released("npm:example@2.0.0", "2026-11-01T00:00:00Z"),
    });
    assert.match(
      summarize(reportDir, now).markdown,
      /\| 2026-11-01 \| npm registry \| Next planned update \|/,
    );
  });

  it("fails on a fix whose release date is unknown, since it cannot be judged", () => {
    writeResults(audit(advisory("moderate", ">=2.0.0", "1.0.0")));
    const { failed, markdown } = summarize(reportDir, now);
    assert.equal(failed, true);
    assert.match(markdown, /\| {2}\| Unknown release date \(overdue\) \|/);
    assert.match(
      markdown,
      /The fixes' release dates could not be found, so every fix counts as overdue\./,
    );
  });

  it("counts every fix as overdue when the fix dates are not a list of fixes", () => {
    for (const fixDates of [["npm:example@2.0.0"], "text", null]) {
      writeResults({
        ...audit(advisory("low", ">=2.0.0", "1.0.0")),
        "fix-dates.json": fixDates,
      });
      const { failed, markdown } = summarize(reportDir, now);
      assert.equal(failed, true);
      assert.match(markdown, /release dates could not be found/);
    }
  });

  it("says which fixes are dated only from the first report that saw them", () => {
    writeResults({
      ...audit(advisory("high", ">=2.0.0", "1.0.0")),
      "fix-dates.json": {
        "npm:example@2.0.0": {
          released: "2026-11-01T00:00:00Z",
          source: "first seen",
        },
      },
    });
    const { markdown } = summarize(reportDir, now);
    assert.match(markdown, /\| 2026-11-01 \| first seen \| 2026-12-31 \|/);
    assert.match(
      markdown,
      /1 fix is dated from the first report that saw it, since its release could not be looked up\./,
    );
    assert.doesNotMatch(markdown, /could not be found/);
  });

  it("names a single vulnerability with no fix in the singular", () => {
    writeResults(audit(advisory("moderate", "", "1.0.0")));
    const { markdown } = summarize(reportDir, now);
    assert.match(
      markdown,
      /1 vulnerability has no fix released yet, and is a warning until one is\./,
    );
    assert.doesNotMatch(markdown, /Critical or high, with no fix/);
  });

  it("does not complete when pnpm audit counts vulnerabilities but lists no advisories", () => {
    writeResults({
      "dependencies.json": {
        metadata: { vulnerabilities: { critical: 1, high: 0 } },
        advisories: {},
      },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /Did not complete/,
    );
    assert.match(
      markdown,
      /pnpm audit counted vulnerabilities but listed no advisories\./,
    );
  });

  it("does not complete when pnpm audit lists no advisories", () => {
    writeResults({
      "dependencies.json": { metadata: { vulnerabilities: {} } },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /Did not complete/,
    );
  });

  it("does not complete when pnpm audit reports an error instead of results", () => {
    writeResults({
      "dependencies.json": { error: { code: "ERR_PNPM_AUDIT_BAD_RESPONSE" } },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /Did not complete/,
    );
  });

  it("counts every secret found as high", () => {
    writeResults({
      "secrets-history.json": [{ RuleID: "example" }, { RuleID: "example" }],
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Secrets in git history"),
      /\| Fail \| 0 \| 2 \| 0 \| 0 \|$/,
    );
  });

  it("does not complete when a secrets result is not a list", () => {
    writeResults({ "secrets-files.json": { message: "unexpected" } });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(rowFor(markdown, "Secrets in files"), /Did not complete/);
  });

  it("does not complete when a results file is missing", () => {
    writeResults();
    rmSync(join(reportDir, "secrets-files.json"));
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(rowFor(markdown, "Secrets in files"), /Did not complete/);
  });

  it("does not complete when a results file is empty", () => {
    writeResults({ "dependencies.json": "" });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /Did not complete/,
    );
  });

  it("does not complete when a results file is not JSON", () => {
    writeResults({ "files.json": "not json" });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities and licences"),
      /Did not complete/,
    );
  });

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

  it("rewrites results files pretty-printed", () => {
    writeResults();
    summarize(reportDir);
    const text = readFileSync(join(reportDir, "code.json"), "utf8");
    assert.match(text, /\n {2}"results": \[\]/);
  });

  it("passes a skipped image scan, saying why and what it compared", () => {
    writeResults({
      "container-images.json": "",
      "scans.json": [{ file: "container-images.json", skipped: "unchanged" }],
    });
    rmSync(join(reportDir, "container-images.json"));
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, false);
    assert.match(rowFor(markdown, "Container images"), /\| Skipped \|/);
    assert.match(
      markdown,
      /- Container images were not built or scanned, since nothing that can change their scan changed against origin\/main: every file other than Fathom's code, .*\. The default branch's images and the newest release's are scanned daily, and each release's as it is published\./,
    );
  });

  it("still fails a skipped scan other than the image scan when its results are missing", () => {
    writeResults({
      "scans.json": [{ file: "code.json", skipped: "unchanged" }],
    });
    rmSync(join(reportDir, "code.json"));
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(rowFor(markdown, "Code security flaws"), /Did not complete/);
  });

  it("passes the scans that need the internet skipped offline, naming each", () => {
    writeResults({
      "scans.json": [
        { file: "dependencies.json", skipped: "offline" },
        { file: "container-images.json", skipped: "offline" },
      ],
    });
    rmSync(join(reportDir, "dependencies.json"));
    rmSync(join(reportDir, "container-images.json"));
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, false);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /\| Skipped \|/,
    );
    assert.match(rowFor(markdown, "Container images"), /\| Skipped \|/);
    for (const note of [
      "- Dependency vulnerabilities: skipped, since the report ran offline. The Check workflow runs it on every pull request.",
      "- Container images: skipped, since the report ran offline. The Check workflow builds and scans them on a pull request that changes what they're built from.",
    ])
      assert.ok(markdown.includes(note), markdown);
  });

  it("still fails a scan skipped for a reason it does not allow", () => {
    writeResults({
      "scans.json": [{ file: "code.json", skipped: "offline" }],
    });
    rmSync(join(reportDir, "code.json"));
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(rowFor(markdown, "Code security flaws"), /Did not complete/);
  });

  it("fails a skipped image scan whose results are there but incomplete", () => {
    writeResults({
      "container-images.json": [{ image: "example/one:1", report: null }],
      "scans.json": [{ file: "container-images.json", skipped: "unchanged" }],
    });
    const { failed } = summarize(reportDir);
    assert.equal(failed, true);
  });

  it("names each result reused from an earlier report, and which report", () => {
    writeResults({
      "scans.json": [
        {
          file: "files.json",
          inputs: { database: "2026-11-07" },
          reusedFrom: "2026-11-07T10-00-00Z",
        },
        {
          file: "container-images.json",
          image: "example/one:1",
          inputs: { database: "2026-11-07" },
          reusedFrom: "2026-11-07T11-00-00Z",
        },
        {
          file: "container-images.json",
          image: "example/two:1",
          inputs: { database: "2026-11-07" },
        },
      ],
    });
    const { markdown } = summarize(reportDir);
    assert.match(
      markdown,
      /- Trivy's scan of dependencies and licences was reused from run 2026-11-07T10-00-00Z, since the dependency files, the exceptions and Trivy's database are unchanged\./,
    );
    assert.match(
      markdown,
      /- The scan of example\/one:1 was reused from run 2026-11-07T11-00-00Z, since the image, the exceptions and Trivy's database are unchanged\./,
    );
    assert.doesNotMatch(markdown, /example\/two:1 was reused/);
  });
});

describe("security summary command", () => {
  beforeEach(() => {
    reportDir = mkdtempSync(join(tmpdir(), "security-summary-"));
  });

  afterEach(() => {
    rmSync(reportDir, { recursive: true, force: true });
  });

  it("exits with 2 when no report folder is given", () => {
    const result = runSummaryScript();
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  });

  it("writes summary.md and exits with 0 when the report passes", () => {
    writeResults();
    const result = runSummaryScript(reportDir);
    assert.equal(result.status, 0);
    assert.match(
      readFileSync(join(reportDir, "summary.md"), "utf8"),
      /\*\*Result:\*\* Pass/,
    );
  });

  it("summarizes only the scan files named, so a folder of image scans alone can pass or fail", () => {
    writeFileSync(
      join(reportDir, "container-images.json"),
      JSON.stringify(cleanResults["container-images.json"]),
    );
    const passed = runSummaryScript(reportDir, "container-images.json");
    assert.equal(passed.status, 0);
    const summary = readFileSync(join(reportDir, "summary.md"), "utf8");
    assert.match(summary, /\*\*Result:\*\* Pass/);
    assert.equal(rowFor(summary, "Secrets in files"), undefined);
    assert.equal(runSummaryScript(reportDir).status, 1);
  });

  it("refuses a name that is no scan's file, rather than judging nothing", () => {
    const result = runSummaryScript(reportDir, "container-image.json");
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Not a scan's file: container-image\.json/);
    assert.equal(existsSync(join(reportDir, "summary.md")), false);
  });

  it("writes summary.md and exits with 1 when the report fails", () => {
    writeResults({ "secrets-files.json": [{ RuleID: "example" }] });
    const result = runSummaryScript(reportDir);
    assert.equal(result.status, 1);
    assert.equal(existsSync(join(reportDir, "summary.md")), true);
  });
});
