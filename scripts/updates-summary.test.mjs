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
import {
  parseRenovateLog,
  renderUpdates,
  summarizeUpdates,
} from "./updates-summary.mjs";

const summaryScript = fileURLToPath(
  new URL("./updates-summary.mjs", import.meta.url),
);

const packageFiles = {
  npm: [
    {
      packageFile: "package.json",
      deps: [
        {
          depName: "example-tool",
          currentValue: "1.0.0",
          updates: [{ newVersion: "1.1.0", updateType: "minor" }],
        },
        {
          depName: "new-tool",
          currentValue: "2.0.0",
          updates: [
            {
              newVersion: "3.0.0",
              updateType: "major",
              isBreaking: true,
              pendingChecks: true,
            },
          ],
        },
        { depName: "settled-tool", currentValue: "2.0.0", updates: [] },
      ],
    },
  ],
  regex: [
    {
      packageFile: "scripts/example.sh",
      deps: [
        {
          depName: "example/image",
          currentDigest: "sha256:aaa",
          updates: [{ newDigest: "sha256:bbb", updateType: "digest" }],
        },
      ],
    },
  ],
};

function logLines(...entries) {
  return entries
    .map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)))
    .join("\n");
}

describe("updates summary", () => {
  it("finds the dependency list in Renovate's log, skipping other lines", () => {
    const log = logLines(
      "not json",
      { msg: "Repository started", level: 30 },
      { msg: "packageFiles with updates", config: packageFiles },
    );
    const { packageFiles: found, problems } = parseRenovateLog(log);
    assert.deepEqual(found, packageFiles);
    assert.deepEqual(problems, []);
  });

  it("reports no dependency list when Renovate did not finish", () => {
    assert.equal(
      parseRenovateLog(logLines({ msg: "Repository started" })).packageFiles,
      undefined,
    );
  });

  it("treats warnings and errors in Renovate's log as problems", () => {
    const { problems } = parseRenovateLog(
      logLines(
        { msg: "Lookup failed", level: 40 },
        { msg: "Crashed", level: 50 },
      ),
    );
    assert.deepEqual(problems, [
      "Renovate logged: Lookup failed",
      "Renovate logged: Crashed",
    ]);
  });

  it("lists every update, marking breaking ones and those still waiting", () => {
    const { updates, dependencyCounts } = summarizeUpdates(packageFiles);
    assert.deepEqual(updates, [
      {
        dependency: "example-tool",
        file: "package.json",
        current: "1.0.0",
        available: "1.1.0",
        type: "minor",
        breaking: false,
        waiting: false,
      },
      {
        dependency: "new-tool",
        file: "package.json",
        current: "2.0.0",
        available: "3.0.0",
        type: "major",
        breaking: true,
        waiting: true,
      },
      {
        dependency: "example/image",
        file: "scripts/example.sh",
        current: "sha256:aaa",
        available: "sha256:bbb",
        type: "digest",
        breaking: false,
        waiting: false,
      },
    ]);
    assert.deepEqual(
      [...dependencyCounts],
      [
        ["npm", 3],
        ["regex", 1],
      ],
    );
  });

  it("treats dependencies skipped by mistake and lookup warnings as problems", () => {
    const { problems, notChecked } = summarizeUpdates({
      npm: [
        {
          packageFile: "package.json",
          deps: [
            { depName: "skipped-tool", skipReason: "unknown-registry" },
            {
              depName: "warned-tool",
              warnings: [{ message: "Failed to look up" }],
            },
          ],
        },
      ],
    });
    assert.deepEqual(problems, [
      "skipped-tool in package.json: unknown-registry (skipped)",
      "warned-tool in package.json: Failed to look up",
    ]);
    assert.deepEqual(notChecked, []);
  });

  it("lists dependencies skipped on purpose as not checked, without a problem", () => {
    const packageFilesWithWorkspace = {
      npm: [
        {
          packageFile: "apps/web/package.json",
          deps: [{ depName: "@fathom/shared", skipReason: "internal-package" }],
        },
      ],
    };
    const summary = summarizeUpdates(packageFilesWithWorkspace);
    assert.deepEqual(summary.problems, []);
    assert.deepEqual(summary.notChecked, [
      "@fathom/shared in apps/web/package.json: internal-package",
    ]);
    assert.match(renderUpdates("run", summary), /## Not Checked/);
  });

  it("separates updates available now from those still waiting", () => {
    const markdown = renderUpdates("run", summarizeUpdates(packageFiles));
    assert.match(markdown, /\*\*Updates available now:\*\* 2/);
    assert.match(
      markdown,
      /\*\*Updates waiting for the seven-day minimum release age:\*\* 1/,
    );
    assert.match(markdown, /## Waiting\n\n[^#]*new-tool/);
  });

  it("renders no tables when nothing needs updating", () => {
    const markdown = renderUpdates(
      "run",
      summarizeUpdates({
        npm: [{ packageFile: "package.json", deps: [{ depName: "a" }] }],
      }),
    );
    assert.match(markdown, /\*\*Updates available now:\*\* 0/);
    assert.doesNotMatch(markdown, /\| Dependency \|/);
  });
});

describe("updates summary command", () => {
  let reportDir;

  beforeEach(() => {
    reportDir = mkdtempSync(join(tmpdir(), "updates-summary-"));
  });

  afterEach(() => {
    rmSync(reportDir, { recursive: true, force: true });
  });

  function runSummary(...args) {
    return spawnSync(process.execPath, [summaryScript, ...args], {
      encoding: "utf8",
    });
  }

  it("exits with 2 when no report folder is given", () => {
    assert.equal(runSummary().status, 2);
  });

  it("exits with 1 when Renovate's log has no results", () => {
    writeFileSync(
      join(reportDir, "renovate.jsonl"),
      logLines({ msg: "Repository started" }),
    );
    const result = runSummary(reportDir);
    assert.equal(result.status, 1);
    assert.equal(existsSync(join(reportDir, "updates.md")), false);
  });

  it("writes updates.md and exits with 1 when Renovate reported problems", () => {
    writeFileSync(
      join(reportDir, "renovate.jsonl"),
      logLines(
        { msg: "Lookup failed", level: 40 },
        { msg: "packageFiles with updates", config: packageFiles },
      ),
    );
    const result = runSummary(reportDir);
    assert.equal(result.status, 1);
    assert.match(
      readFileSync(join(reportDir, "updates.md"), "utf8"),
      /## Problems/,
    );
  });

  it("writes updates.md and exits with 0 when updates are available", () => {
    writeFileSync(
      join(reportDir, "renovate.jsonl"),
      logLines({ msg: "packageFiles with updates", config: packageFiles }),
    );
    const result = runSummary(reportDir);
    assert.equal(result.status, 0);
    assert.match(
      readFileSync(join(reportDir, "updates.md"), "utf8"),
      /example-tool/,
    );
  });
});
