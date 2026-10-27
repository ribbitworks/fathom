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

const summaryScript = fileURLToPath(
  new URL("./security-summary.mjs", import.meta.url),
);

const lockfileTarget = { Target: "pnpm-lock.yaml", Class: "lang-pkgs" };

const cleanResults = {
  "dependencies.json": {
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
    },
  },
  "secrets-files.json": [],
  "secrets-history.json": [],
  "code.json": {
    results: [],
    errors: [],
    paths: { scanned: ["package.json"] },
  },
  "files.json": { Results: [lockfileTarget] },
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

  it("fails on a critical dependency vulnerability", () => {
    writeResults({
      "dependencies.json": { metadata: { vulnerabilities: { critical: 1 } } },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /\| Fail \| 1 \| 0 \| 0 \| 0 \|$/,
    );
  });

  it("fails on a high dependency vulnerability and maps the other severities", () => {
    writeResults({
      "dependencies.json": {
        metadata: {
          vulnerabilities: {
            info: 1,
            low: 1,
            moderate: 1,
            high: 1,
            critical: 0,
          },
        },
      },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Dependency vulnerabilities"),
      /\| Fail \| 0 \| 1 \| 1 \| 2 \|$/,
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
      rowFor(markdown, "Vulnerabilities, misconfiguration, and licences"),
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

  it("maps Semgrep severities and notes lesser Semgrep errors", () => {
    writeResults({
      "code.json": {
        results: [
          { extra: { severity: "WARNING" } },
          { extra: { severity: "INFO" } },
        ],
        errors: [{ level: "warn" }],
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
      rowFor(markdown, "Vulnerabilities, misconfiguration, and licences"),
      /Did not complete/,
    );
  });

  it("does not complete when Trivy returns no results", () => {
    writeResults({ "files.json": {} });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Vulnerabilities, misconfiguration, and licences"),
      /Did not complete/,
    );
  });

  it("counts Trivy misconfigurations", () => {
    writeResults({
      "files.json": {
        Results: [
          lockfileTarget,
          { Target: "Dockerfile", Misconfigurations: [{ Severity: "HIGH" }] },
        ],
      },
    });
    const { failed, markdown } = summarize(reportDir);
    assert.equal(failed, true);
    assert.match(
      rowFor(markdown, "Vulnerabilities, misconfiguration, and licences"),
      /\| Fail \| 0 \| 1 \| 0 \| 0 \|$/,
    );
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
      rowFor(markdown, "Vulnerabilities, misconfiguration, and licences"),
      /\| Pass \| 0 \| 0 \| 2 \| 0 \|$/,
    );
  });

  it("rewrites results files pretty-printed", () => {
    writeResults();
    summarize(reportDir);
    const text = readFileSync(join(reportDir, "code.json"), "utf8");
    assert.match(text, /\n {2}"results": \[\]/);
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

  it("writes summary.md and exits with 1 when the report fails", () => {
    writeResults({ "secrets-files.json": [{ RuleID: "example" }] });
    const result = runSummaryScript(reportDir);
    assert.equal(result.status, 1);
    assert.equal(existsSync(join(reportDir, "summary.md")), true);
  });
});
