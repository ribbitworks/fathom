import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cutoffFor,
  findExpiredReports,
  parseArguments,
  parseReportTime,
  parseRetentionDays,
} from "./prune-reports.mjs";

const pruneScript = fileURLToPath(
  new URL("./prune-reports.mjs", import.meta.url),
);

describe("report names", () => {
  it("reads the UTC time from a report folder name", () => {
    assert.equal(
      parseReportTime("2026-10-27T13-28-14Z")?.toISOString(),
      "2026-10-27T13:28:14.000Z",
    );
  });

  it("ignores names that are not report times, or are not real dates", () => {
    assert.equal(parseReportTime("notes"), undefined);
    assert.equal(parseReportTime("2026-10-27"), undefined);
    assert.equal(parseReportTime("2026-02-30T00-00-00Z"), undefined);
  });
});

describe("retention period", () => {
  it("defaults to 365 days", () => {
    assert.equal(parseRetentionDays(undefined), 365);
  });

  it("reads leading zeros as decimal, not octal", () => {
    assert.equal(parseRetentionDays("0365"), 365);
    assert.equal(parseRetentionDays("010"), 10);
  });

  it("accepts a leading -- from pnpm and refuses extra arguments", () => {
    assert.equal(parseArguments(["--", "30"]), 30);
    assert.equal(parseArguments([]), 365);
    assert.throws(() => parseArguments(["30", "40"]), /Usage/);
  });

  it("rejects values that are not whole numbers in range", () => {
    for (const value of [
      "",
      "abc",
      "-5",
      "1.5",
      "0",
      "36501",
      "99999999999999999999",
    ]) {
      assert.throws(() => parseRetentionDays(value), /retention period/, value);
    }
  });
});

describe("cutoff", () => {
  const now = new Date("2026-10-27T12:00:00Z");

  it("uses the number of days for reports other than security reports", () => {
    assert.equal(
      cutoffFor("updates", now, 30).toISOString(),
      "2026-09-27T12:00:00.000Z",
    );
  });

  it("keeps security reports for at least one calendar year, whatever the number of days", () => {
    assert.equal(
      cutoffFor("security", now, 30).toISOString(),
      "2025-10-27T12:00:00.000Z",
    );
  });

  it("lets a longer number of days keep security reports longer", () => {
    assert.equal(
      cutoffFor("security", now, 730).toISOString(),
      "2024-10-27T12:00:00.000Z",
    );
  });

  it("keeps security reports a full year across a leap day", () => {
    const cutoff = cutoffFor("security", new Date("2028-03-01T00:00:00Z"), 365);
    assert.equal(cutoff.toISOString(), "2027-03-01T00:00:00.000Z");
    assert.equal(new Date("2027-03-01T12:00:00Z") < cutoff, false);
  });
});

describe("expired reports", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  let outputDir;

  function makeReport(reportType, name) {
    const path = join(outputDir, reportType, name);
    mkdirSync(path, { recursive: true });
    return path;
  }

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), "prune-reports-"));
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("finds reports past their cutoff and keeps newer ones", () => {
    const old = makeReport("updates", "2026-01-01T00-00-00Z");
    makeReport("updates", "2026-10-01T00-00-00Z");
    assert.deepEqual(findExpiredReports(outputDir, now, 30), [old]);
  });

  it("keeps security reports younger than one year even with a short period", () => {
    makeReport("security", "2026-01-01T00-00-00Z");
    const old = makeReport("security", "2025-01-01T00-00-00Z");
    assert.deepEqual(findExpiredReports(outputDir, now, 30), [old]);
  });

  it("never includes undated folders, dated files, or symbolic links", () => {
    makeReport("updates", "keep-me");
    writeFileSync(
      join(outputDir, "updates", "2020-02-02T00-00-00Z"),
      "not a folder",
    );
    const target = makeReport("elsewhere", "2026-10-26T00-00-00Z");
    symlinkSync(target, join(outputDir, "updates", "2020-01-01T00-00-00Z"));
    assert.deepEqual(findExpiredReports(outputDir, now, 30), []);
  });

  it("returns nothing when there is no output folder", () => {
    assert.deepEqual(
      findExpiredReports(join(outputDir, "missing"), now, 30),
      [],
    );
  });
});

describe("prune command", () => {
  it("exits with 2 and a clear message for an invalid period", () => {
    const result = spawnSync(process.execPath, [pruneScript, "30x"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /whole number of days/);
  });
});
