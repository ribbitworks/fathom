// SPDX-License-Identifier: Apache-2.0

// Tests for summarizing security reports: failing when a vulnerability's fix is overdue, another scan
// finds a critical or high issue, or a scan does not complete, warning about vulnerabilities with no
// fix released, scans skipped or reused, and the command that writes the summary.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { summarize } from "./security-summary.mjs";
import {
  cleanResults,
  lockfileTarget,
  makeReportFolder,
  now,
  removeReportFolder,
  reportDir,
  rowFor,
  writeResults,
} from "./test-security-summary.mjs";

const summaryScript = fileURLToPath(
  new URL("./security-summary.mjs", import.meta.url),
);

function runSummaryScript(...args) {
  return spawnSync(process.execPath, [summaryScript, ...args], {
    encoding: "utf8",
  });
}

describe("security summary", () => {
  beforeEach(makeReportFolder);
  afterEach(removeReportFolder);

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
  beforeEach(makeReportFolder);
  afterEach(removeReportFolder);

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
